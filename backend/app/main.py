"""Spellnook API."""
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import auth, game, multiplayer, stats, words
from .db import SessionLocal, get_session, init_db
from .models import GameResult, User


@asynccontextmanager
async def lifespan(app: "FastAPI"):
    await init_db()
    yield

app = FastAPI(title="Spellnook API", version="0.3.0", lifespan=lifespan)

ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")

# CORS_ALLOW_ORIGINS: comma-separated origins, or "*" (dev default).
# In prod set it to the real origin(s), e.g. "https://play.spellnook.com".
_cors = os.environ.get("CORS_ALLOW_ORIGINS", "*").strip()
_allow_origins = ["*"] if _cors == "*" else [o.strip() for o in _cors.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GuessRequest(BaseModel):
    game_id: str = Field(..., alias="gameId")
    guess: str
    guess_index: int = Field(0, alias="guessIndex")

    model_config = {"populate_by_name": True}


class GuessResponse(BaseModel):
    valid: bool
    statuses: list[str] = []
    won: bool = False
    answer: str | None = None
    reason: str | None = None


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "environment": ENVIRONMENT,
        "lengths": {n: len(words.get_answers(n)) for n in words.SUPPORTED_LENGTHS},
        "authConfigured": auth.auth_configured(),
    }


@app.get("/api/game/daily")
def daily_game(length: int = Query(game.DEFAULT_LENGTH, ge=4, le=7)):
    available = words.available_lengths()
    if length not in available:
        raise HTTPException(status_code=404, detail=f"length {length} unavailable")
    game_id = game.daily_game_id(length)
    return {
        "gameId": game_id,
        "date": game.parse_game_id(game_id)[0].isoformat(),
        "wordLength": length,
        "maxGuesses": game.max_guesses(length),
        "availableLengths": available,
    }


@app.post("/api/guess", response_model=GuessResponse)
def submit_guess(req: GuessRequest):
    guess = req.guess.strip().lower()
    _, length = game.parse_game_id(req.game_id)

    if len(guess) != length:
        return GuessResponse(valid=False, reason="wrong_length")
    if not words.is_allowed(guess, length):
        return GuessResponse(valid=False, reason="not_in_word_list")

    answer = game.answer_for_game(req.game_id)
    if answer is None:
        raise HTTPException(status_code=404, detail="no puzzle for this game")

    statuses = game.score_guess(guess, answer)
    won = all(s == "correct" for s in statuses)

    # Reveal answer only on win or after the final allowed guess (loss).
    is_final = req.guess_index >= game.max_guesses(length) - 1
    answer_out = answer if (won or is_final) else None

    return GuessResponse(valid=True, statuses=statuses, won=won, answer=answer_out)


# --------------------------------------------------------------------------
# Auth + accounts + stats + leaderboard
# --------------------------------------------------------------------------


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token from Google Identity Services


class ResultIn(BaseModel):
    mode: str
    length: int
    won: bool
    guesses: int
    durationMs: int | None = None
    puzzleDate: date | None = None


def _user_public(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "picture": u.picture}


@app.post("/api/auth/google")
async def auth_google(body: GoogleAuthRequest, session: AsyncSession = Depends(get_session)):
    info = auth.verify_google_credential(body.credential)
    sub = info["sub"]
    user = await session.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        user = User(
            google_sub=sub,
            email=info.get("email", ""),
            name=(info.get("name") or info.get("email", "Player"))[:64],
            picture=info.get("picture"),
        )
        session.add(user)
    else:
        user.name = (info.get("name") or user.name)[:64]
        user.picture = info.get("picture") or user.picture
    await session.commit()
    await session.refresh(user)
    return {"token": auth.issue_token(user.id), "user": _user_public(user)}


@app.get("/api/me")
async def get_me(
    user: User = Depends(auth.current_user), session: AsyncSession = Depends(get_session)
):
    return {"user": _user_public(user), "stats": await stats.user_stats(session, user.id)}


@app.post("/api/results")
async def record_result(
    body: ResultIn,
    user: User = Depends(auth.current_user),
    session: AsyncSession = Depends(get_session),
):
    if body.mode not in ("daily", "practice"):
        raise HTTPException(status_code=400, detail="invalid_mode")
    session.add(
        GameResult(
            user_id=user.id,
            mode=body.mode,
            length=body.length,
            won=body.won,
            guesses=body.guesses,
            duration_ms=body.durationMs,
            puzzle_date=body.puzzleDate,
        )
    )
    await session.commit()
    return {"ok": True}


@app.get("/api/leaderboard")
async def get_leaderboard(session: AsyncSession = Depends(get_session)):
    return {
        "daily": await stats.leaderboard(session, "daily"),
        "multi": await stats.leaderboard(session, "multi"),
    }


MAX_FREE_MP_GAMES = 3


@app.get("/api/mp/quota")
async def mp_quota(
    user: User = Depends(auth.current_user), session: AsyncSession = Depends(get_session)
):
    played = await stats.mp_games_today(session, user.id)
    return {
        "limit": MAX_FREE_MP_GAMES,
        "playedToday": played,
        "remaining": max(0, MAX_FREE_MP_GAMES - played),
    }


# --------------------------------------------------------------------------
# Multiplayer (guest): create a room over REST, then play over WebSocket.
# --------------------------------------------------------------------------


async def _record_room_results(room: multiplayer.Room) -> None:
    """Persist multiplayer results for signed-in players (once per round)."""
    if room.phase != "finished" or room.recorded:
        return
    room.recorded = True
    rows = [
        (p.user_id, p.won, p.guess_count, p.finish_time)
        for p in room.players.values()
        if p.user_id
    ]
    if not rows:
        return
    async with SessionLocal() as session:
        for user_id, won, guesses, finish_time in rows:
            session.add(
                GameResult(
                    user_id=user_id,
                    mode="multi",
                    length=room.length,
                    won=won,
                    guesses=guesses,
                    duration_ms=int((finish_time or 0) * 1000),
                )
            )
        try:
            await session.commit()
        except Exception:  # noqa: BLE001 - never let stat-recording break the game
            await session.rollback()


@app.post("/api/room")
async def create_room(user: User = Depends(auth.current_user)):
    room = multiplayer.manager.create()
    if room is None:
        raise HTTPException(status_code=503, detail="rooms_at_capacity")
    return {"code": room.code}


@app.websocket("/ws/room/{code}")
async def ws_room(
    websocket: WebSocket,
    code: str,
    name: str = Query("Player"),
    cid: str = Query(...),
    token: str | None = Query(default=None),
):
    room = multiplayer.manager.get(code)
    if room is None:
        await websocket.accept()
        await websocket.send_json({"type": "error", "reason": "room_not_found"})
        await websocket.close()
        return

    await websocket.accept()
    cid = cid or uuid.uuid4().hex[:8]
    display = (name or "Player")[:20]
    user_id = auth.decode_user_id(token) if token else None

    # Multiplayer requires sign-in (so the per-user daily limit is enforceable).
    if user_id is None:
        await websocket.send_json({"type": "error", "reason": "auth_required"})
        await websocket.close()
        return

    async with room.lock:
        existing = room.players.get(cid)
        if existing is not None:
            # Reconnection: rebind socket, keep all progress.
            existing.ws = websocket
            existing.connected = True
            existing.user_id = user_id or existing.user_id
            player = existing
            if room.cleanup_task and not room.cleanup_task.done():
                room.cleanup_task.cancel()
        else:
            if not room.has_capacity():
                await websocket.send_json({"type": "error", "reason": "room_full"})
                await websocket.close()
                return
            if room.phase != "waiting":
                await websocket.send_json({"type": "error", "reason": "in_progress"})
                await websocket.close()
                return
            async with SessionLocal() as s:
                if await stats.mp_games_today(s, user_id) >= MAX_FREE_MP_GAMES:
                    await websocket.send_json({"type": "error", "reason": "limit_reached"})
                    await websocket.close()
                    return
            player = multiplayer.Player(cid, display, websocket)
            player.user_id = user_id
            room.players[cid] = player
            if room.host_id is None:
                room.host_id = cid
        await websocket.send_json({"type": "welcome", "you": player.id, "hostId": room.host_id})
        await multiplayer.broadcast(room)

    left = False
    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")

            if mtype == "leave":
                left = True
                break

            if mtype == "start" and player.id == room.host_id:
                async with room.lock:
                    length = int(msg.get("length", multiplayer.DEFAULT_LENGTH))
                    # Enforce per-player daily quota: host blocked if out of games;
                    # any other player out of games is dropped from the room.
                    blocked_host = False
                    async with SessionLocal() as s:
                        for p in list(room.players.values()):
                            if not p.user_id:
                                continue
                            if await stats.mp_games_today(s, p.user_id) >= MAX_FREE_MP_GAMES:
                                if p.id == player.id:
                                    blocked_host = True
                                else:
                                    try:
                                        if p.ws:
                                            await p.ws.send_json({"type": "error", "reason": "limit_reached"})
                                    except Exception:  # noqa: BLE001
                                        pass
                                    room.players.pop(p.id, None)
                    if blocked_host:
                        await websocket.send_json({"type": "error", "reason": "limit_reached"})
                    elif room.players and room.start(length):
                        await multiplayer.broadcast(room)
                    else:
                        await websocket.send_json({"type": "error", "reason": "length_unavailable"})

            elif mtype == "guess":
                async with room.lock:
                    result = room.apply_guess(player, str(msg.get("guess", "")))
                    await websocket.send_json({"type": "guess_result", **result})
                    if result.get("valid"):
                        room.maybe_finish()
                        await _record_room_results(room)
                        await multiplayer.broadcast(room)

    except WebSocketDisconnect:
        pass

    async with room.lock:
        if left:
            # Explicit leave: free the slot entirely.
            room.players.pop(player.id, None)
            if room.host_id == player.id:
                room.host_id = next(iter(room.players), None)
        else:
            # Transient disconnect: keep progress AND host role — the player
            # (including the host) is expected to reconnect. The host only
            # changes on an explicit leave, so start stays host-only.
            player.connected = False
            player.ws = None

        if room.players:
            room.maybe_finish()
            await _record_room_results(room)
            await multiplayer.broadcast(room)
            if not room.any_connected():
                multiplayer.manager.schedule_cleanup(room)
        else:
            multiplayer.manager.delete(room)
