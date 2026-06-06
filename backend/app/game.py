"""Core game logic — framework-agnostic and easy to unit test.

gameId encodes the puzzle: "<ISO-date>:<length>" (e.g. "2026-05-31:5").
Multiplayer note: later a gameId can be a room id whose answer is looked up
from Redis instead of derived from the date.
"""
from datetime import date

from . import words

DEFAULT_LENGTH = 5

# Fixed epoch so the daily word is deterministic and stable across restarts.
_EPOCH = date(2026, 1, 1)


def max_guesses(length: int) -> int:
    """Wordle uses 6 for 5 letters; we scale fairly with length."""
    return length + 1


def daily_game_id(length: int = DEFAULT_LENGTH, today: date | None = None) -> str:
    return f"{(today or date.today()).isoformat()}:{length}"


def parse_game_id(game_id: str) -> tuple[date, int]:
    parts = game_id.split(":")
    try:
        d = date.fromisoformat(parts[0])
    except (ValueError, IndexError):
        d = date.today()
    try:
        length = int(parts[1])
    except (ValueError, IndexError):
        length = DEFAULT_LENGTH
    return d, length


def answer_for_game(game_id: str) -> str | None:
    """Deterministic daily answer derived from the gameId (date + length)."""
    d, length = parse_game_id(game_id)
    pool = words.get_answers(length)
    if not pool:
        return None
    index = (d - _EPOCH).days % len(pool)
    return pool[index]


def score_guess(guess: str, answer: str) -> list[str]:
    """Return per-letter status: 'correct' | 'present' | 'absent'.

    Two-pass scoring so duplicate letters are handled correctly.
    """
    guess = guess.lower()
    answer = answer.lower()
    statuses = ["absent"] * len(guess)
    remaining: dict[str, int] = {}

    # Pass 1: exact matches.
    for i, (g, a) in enumerate(zip(guess, answer)):
        if g == a:
            statuses[i] = "correct"
        else:
            remaining[a] = remaining.get(a, 0) + 1

    # Pass 2: present-but-misplaced, limited by remaining counts.
    for i, g in enumerate(guess):
        if statuses[i] == "correct":
            continue
        if remaining.get(g, 0) > 0:
            statuses[i] = "present"
            remaining[g] -= 1

    return statuses
