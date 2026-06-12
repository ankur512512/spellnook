"""Guest multiplayer: realtime word-race rooms over WebSockets.

No auth — players join with a display name + a short room code, and carry a
stable client id (generated + stored client-side) so a refresh/disconnect
reconnects to the *same* player slot without losing progress.

Server is authoritative (holds the answer, validates + scores guesses).
State is in-memory for the MVP; a later phase can back rooms with Redis and
identify players via real accounts (the wire protocol stays the same).

Race ranking: winners first, fewest guesses then fastest finish; non-winners
after, by who got furthest.
"""
from __future__ import annotations

import asyncio
import os
import random
import string
import time
from typing import Any

from fastapi import WebSocket

from . import game, words

CODE_LEN = 4
DEFAULT_LENGTH = 5
MAX_PLAYERS = 6
MAX_ROOMS = 2000  # global cap so room creation can't exhaust memory
GRACE_SECONDS = 60  # keep an all-disconnected room alive this long (for refresh)


def _gen_code() -> str:
    return "".join(random.choices(string.ascii_uppercase, k=CODE_LEN))


class Player:
    def __init__(self, cid: str, name: str, ws: WebSocket) -> None:
        self.id = cid
        self.name = name
        self.ws: WebSocket | None = ws
        self.user_id: str | None = None  # set when the player is signed in
        self.connected = True
        self.rows: list[list[str]] = []  # per-guess status arrays (colors only)
        self.guess_count = 0
        self.finished = False
        self.won = False
        self.finish_time: float | None = None  # seconds since round start
        self.rank: int | None = None

    def reset(self) -> None:
        self.rows = []
        self.guess_count = 0
        self.finished = False
        self.won = False
        self.finish_time = None
        self.rank = None

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "connected": self.connected,
            "rows": self.rows,
            "guessCount": self.guess_count,
            "finished": self.finished,
            "won": self.won,
            "rank": self.rank,
        }


class Room:
    def __init__(self, code: str) -> None:
        self.code = code
        self.players: dict[str, Player] = {}  # keyed by client id
        self.host_id: str | None = None
        self.phase = "waiting"  # waiting | playing | finished
        self.length = DEFAULT_LENGTH
        self.max_guesses = game.max_guesses(DEFAULT_LENGTH)
        self.answer: str | None = None
        self.round = 0
        self.recorded = False  # have we persisted results for the current round?
        self.start_monotonic: float | None = None
        self.lock = asyncio.Lock()
        self.cleanup_task: asyncio.Task | None = None

    # ---- lifecycle ----
    def has_capacity(self) -> bool:
        return len(self.players) < MAX_PLAYERS

    def any_connected(self) -> bool:
        return any(p.connected for p in self.players.values())

    def start(self, length: int) -> bool:
        pool = words.get_answers(length)
        if not pool:
            return False
        self.length = length
        self.max_guesses = game.max_guesses(length)
        # Test-only override (unset in prod) so smoke tests are deterministic.
        forced = os.environ.get("SPELLNOOK_TEST_MP_ANSWER")
        self.answer = forced.lower() if forced and len(forced) == length else random.choice(pool)
        self.phase = "playing"
        self.round += 1
        self.recorded = False
        self.start_monotonic = time.monotonic()
        for p in self.players.values():
            p.reset()
        return True

    def all_finished(self) -> bool:
        return bool(self.players) and all(p.finished for p in self.players.values())

    def maybe_finish(self) -> None:
        if self.phase != "playing":
            return
        someone_won = any(p.won for p in self.players.values())
        if someone_won or self.all_finished():
            # First win ends the round for everyone; stragglers are marked as lost.
            for p in self.players.values():
                if not p.finished:
                    p.finished = True
                    p.won = False
            self.phase = "finished"
            self._rank()

    def _rank(self) -> None:
        order = sorted(
            self.players.values(),
            key=lambda p: (
                0 if p.won else 1,
                p.guess_count if p.won else -p.guess_count,
                p.finish_time if p.finish_time is not None else float("inf"),
            ),
        )
        for i, p in enumerate(order):
            p.rank = i + 1

    # ---- scoring ----
    def apply_guess(self, player: Player, guess: str) -> dict[str, Any]:
        guess = guess.strip().lower()
        if self.phase != "playing":
            return {"valid": False, "reason": "not_playing"}
        if player.finished:
            return {"valid": False, "reason": "already_finished"}
        if len(guess) != self.length:
            return {"valid": False, "reason": "wrong_length"}
        if not words.is_allowed(guess, self.length):
            return {"valid": False, "reason": "not_in_word_list"}

        assert self.answer is not None
        statuses = game.score_guess(guess, self.answer)
        player.rows.append(statuses)
        player.guess_count += 1
        won = all(s == "correct" for s in statuses)

        if won or player.guess_count >= self.max_guesses:
            player.finished = True
            player.won = won
            elapsed = time.monotonic() - (self.start_monotonic or time.monotonic())
            player.finish_time = round(elapsed, 2)

        return {
            "valid": True,
            "statuses": statuses,
            "won": won,
            "answer": self.answer if player.finished else None,
        }

    def state(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "phase": self.phase,
            "round": self.round,
            "length": self.length,
            "maxGuesses": self.max_guesses,
            "maxPlayers": MAX_PLAYERS,
            "hostId": self.host_id,
            "answer": self.answer if self.phase == "finished" else None,
            "players": [p.public() for p in self.players.values()],
        }


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}

    def create(self) -> Room | None:
        if len(self.rooms) >= MAX_ROOMS:
            return None  # at capacity
        code = _gen_code()
        while code in self.rooms:
            code = _gen_code()
        room = Room(code)
        self.rooms[code] = room
        return room

    def get(self, code: str) -> Room | None:
        return self.rooms.get(code.upper())

    def delete(self, room: Room) -> None:
        self.rooms.pop(room.code, None)

    def schedule_cleanup(self, room: Room) -> None:
        """If everyone has disconnected, delete the room after a grace period."""
        if room.any_connected():
            return
        if room.cleanup_task and not room.cleanup_task.done():
            return
        room.cleanup_task = asyncio.create_task(self._cleanup_later(room))

    async def _cleanup_later(self, room: Room) -> None:
        try:
            await asyncio.sleep(GRACE_SECONDS)
        except asyncio.CancelledError:
            return
        if not room.any_connected():
            self.delete(room)


manager = RoomManager()


async def broadcast(room: Room) -> None:
    """Send full room state to every connected player; drop dead sockets."""
    payload = {"type": "state", "room": room.state()}
    for p in list(room.players.values()):
        if not p.connected or p.ws is None:
            continue
        try:
            await p.ws.send_json(payload)
        except Exception:  # noqa: BLE001 - socket closed mid-broadcast
            p.connected = False
            p.ws = None
