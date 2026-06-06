"""Build word lists for Spellnook from open-source dictionaries, per length.

We deliberately do NOT vendor giant word lists in source. Instead we fetch
permissively-licensed lists at build time and filter to clean words.

Run:  python scripts/fetch_words.py
Outputs (app/data/), for each length in LENGTHS:
  - allowed_{n}.txt : every valid guess  (source: dwyl/english-words, Unlicense)
  - answers_{n}.txt : common-word answer pool (source: google-10000-english-no-swears)

The committed answers.txt (5-letter) remains the offline fallback.
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

LENGTHS = (4, 5, 6, 7)

ALLOWED_URL = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
# Frequency-ordered common words, swears already removed -> good answer pools.
COMMON_URL = (
    "https://raw.githubusercontent.com/first20hours/"
    "google-10000-english/master/google-10000-english-no-swears.txt"
)

DATA = Path(__file__).resolve().parent.parent / "app" / "data"


def fetch(url: str) -> list[str]:
    print(f"Fetching {url} ...", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8", errors="ignore")
    return raw.splitlines()


def clean_by_length(lines: list[str], length: int) -> list[str]:
    seen = {
        w.strip().lower()
        for w in lines
        if len(w.strip()) == length and w.strip().isalpha()
    }
    return sorted(seen)


def main() -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    try:
        allowed_lines = fetch(ALLOWED_URL)
        common_lines = fetch(COMMON_URL)
    except Exception as exc:  # noqa: BLE001 - build-time best-effort
        print(f"WARN: fetch failed ({exc}); leaving existing data in place", file=sys.stderr)
        return 0

    for n in LENGTHS:
        allowed = clean_by_length(allowed_lines, n)
        # Common-word answers, restricted to real dictionary words.
        allowed_set = set(allowed)
        answers = [w for w in clean_by_length(common_lines, n) if w in allowed_set]

        (DATA / f"allowed_{n}.txt").write_text("\n".join(allowed) + "\n")
        (DATA / f"answers_{n}.txt").write_text("\n".join(answers) + "\n")
        print(f"len {n}: {len(allowed)} allowed, {len(answers)} answers", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
