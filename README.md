# Spellnook

A Wordle-style daily word game. React + TypeScript frontend, FastAPI backend, Dockerized.

> Name pending trademark/domain verification. Built to grow toward multiplayer + custom animations — see [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start (local dev, hot reload)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:8000  (health: `/api/health`)

The Vite dev server proxies `/api` to the backend container.

## Production-like run

```bash
docker compose -f docker-compose.prod.yml up --build
# App: http://localhost:8080  (nginx serves built FE + proxies /api)
```

The dev stack now includes **Postgres** (accounts/stats). Google sign-in is
optional — set the client ID to enable it (see [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md)).
Without it, the daily game + guest multiplayer work fully; the Stats tab shows a hint.

## Project layout

```
backend/   FastAPI app (game logic, word lists, multiplayer WS, auth, stats)
frontend/  React + TS + Vite (Daily / Multiplayer / Stats)
docs/      ROADMAP.md (plan), PROGRESS.md (checklist), AUTH_SETUP.md (Google sign-in)
```

## Word lists
- `backend/app/data/answers.txt` — curated daily-answer pool (committed).
- `backend/app/data/allowed.txt` — full valid-guess dictionary, generated at
  build time by `backend/scripts/fetch_words.py` (not committed). Regenerate:
  ```bash
  cd backend && python scripts/fetch_words.py
  ```

## Status
See [docs/PROGRESS.md](docs/PROGRESS.md). Current: playable MVP (Phases 1–3 + basic animations).
