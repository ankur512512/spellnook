"""Word lists for Spellnook, grouped by word length.

Daily-answer pools and allowed-guess dictionaries are loaded per length so we
can support variable word lengths (4-7).

Data files (in app/data/):
  - answers.txt        : committed curated 5-letter answer pool (offline fallback).
  - answers_{n}.txt    : common-word answer pools per length (generated, optional).
  - allowed_{n}.txt    : full valid-guess dictionary per length (generated, optional).

Generated files come from scripts/fetch_words.py and are not committed.
"""
from pathlib import Path

SUPPORTED_LENGTHS: tuple[int, ...] = (4, 5, 6, 7)

_DATA = Path(__file__).parent / "data"


def _load_file(path: Path, length: int) -> list[str]:
    if not path.exists():
        return []
    words = [w.strip().lower() for w in path.read_text().splitlines()]
    return [w for w in words if len(w) == length and w.isalpha()]


def _load_answers(length: int) -> list[str]:
    pool = _load_file(_DATA / f"answers_{length}.txt", length)
    if not pool and length == 5:
        # Committed curated fallback so length 5 always works, even offline.
        pool = _load_file(_DATA / "answers.txt", length)
    return pool


def _load_allowed(length: int, answers: list[str]) -> set[str]:
    allowed = set(_load_file(_DATA / f"allowed_{length}.txt", length))
    # Answers are always valid guesses; if no dictionary, answers are the list.
    return allowed | set(answers)


# length -> answer pool / allowed set
ANSWERS: dict[int, list[str]] = {n: _load_answers(n) for n in SUPPORTED_LENGTHS}
ALLOWED: dict[int, set[str]] = {n: _load_allowed(n, ANSWERS[n]) for n in SUPPORTED_LENGTHS}


def available_lengths() -> list[int]:
    """Lengths that have a usable answer pool (so the UI only offers playable modes)."""
    return [n for n in SUPPORTED_LENGTHS if ANSWERS.get(n)]


def get_answers(length: int) -> list[str]:
    return ANSWERS.get(length, [])


def is_allowed(word: str, length: int) -> bool:
    return word.lower() in ALLOWED.get(length, set())
