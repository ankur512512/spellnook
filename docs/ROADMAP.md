# Spellnook — Roadmap

A Wordle-style daily word game. **Name:** Spellnook (verify trademark + domain before prod).

## Tech stack
- **Frontend:** React + TypeScript + Vite, Zustand for state, plain CSS (CSS Modules-ready).
- **Backend:** FastAPI (Python 3.12), async, WebSocket-ready for future multiplayer.
- **Edge/prod:** nginx serves built frontend + reverse-proxies `/api` to backend.
- **Datastore:** none in MVP (static word lists). Later: Redis (live games/daily word) + Postgres (users/stats).
- **Orchestration:** docker-compose (`docker-compose.yml` dev w/ hot reload, `docker-compose.prod.yml` prod).

## Architecture principles (so we can add multiplayer + animations later)
- Answer + guess validation live **server-side** (anti-cheat; same surface multiplayer needs).
- A `gameId` concept exists from day one (MVP: gameId = date).
- Game logic isolated in `backend/app/game.py`; FE state in a Zustand store that can swap local -> server-synced.
- Animations isolated to the `Tile`/`Board` components via CSS classes (easy to replace).

## API (MVP)
- `GET  /api/health` -> `{status}`
- `GET  /api/game/daily` -> `{gameId, date, wordLength, maxGuesses}`
- `POST /api/guess` body `{gameId, guess, guessIndex}` -> `{valid, statuses[], won, answer?}`
  - `statuses`: list of `"correct"|"present"|"absent"` per letter.
  - `answer` only returned when `won` or final guess (loss reveal).
- `POST /api/room` -> `{code}` (create a guest multiplayer room).
- `WS /ws/room/{code}?name=` — realtime race. Client msgs: `{type:"start",length}` (host),
  `{type:"guess",guess}`. Server msgs: `welcome`, `state` (full room), `guess_result`, `error`.
  Server authoritative (holds answer, scores). Rank: winners by guesses-then-time, losers after.

## Differentiation (what makes Spellnook != Wordle)
Game *mechanics* are not copyrightable (Wordle itself derives from Jotto/Lingo/Mastermind);
only specific expression is. So we differentiate via our own identity + distinct twists:
- **Variable word length (4–7).** `wordLength` per-mode; board flexes. `maxGuesses = length + 1`. (Phase: in progress)
- **Unlimited / practice mode** alongside the shareable daily.
- **Multiplayer race:** same word head-to-head; rank by **guesses used, then time** (rewards skill, not typing speed).
- **Timed / Blitz mode** with a leaderboard (opt-in per mode).
- **Hint economy:** earn hints (reveal a position / eliminate letters) via streaks.
- **Daily modifiers:** rotating constraints (no repeated letters, themed word sets, etc.).
- **Accounts + ELO/MMR** for multiplayer, stats, streaks, achievements.
Sequence: variable length → unlimited → multiplayer race → timer/leaderboard → hints/modifiers → accounts.

## 🚩 Launch gate (must clear BEFORE going public)
- **Own visual identity:** replace the placeholder Wordle-like palette/fonts with a distinct
  Spellnook palette (own correct/present colors, typeface, logo, tile/keyboard treatment).
  Cheap/late change — everything is CSS-variable tokenized. Currently familiar-by-design for MVP.
- **Legal clearance:** USPTO/EUIPO trademark search on "Spellnook" + domain availability.
- **No NYT assets:** confirm no copied logo, copy, fonts, or scraped word lists.

## Phases
1. **Scaffold + Docker** — compose up; FE talks to BE `/api/health` on localhost. ✅ target
2. **Core game (FE)** — 6x5 board, on-screen + physical keyboard, win/lose flow.
3. **Word logic (BE)** — word lists, deterministic daily word, guess validation.
4. **Polish** — flip/shake/pop animations, stats modal, share grid, localStorage persistence, responsive + dark mode.
5. **Hardening** — tests (pytest + vitest), prod compose + nginx, env config, CI.
6. **Features** — multiplayer (WebSockets), accounts, leaderboards, custom animations/themes.

## Legal notes
- Do NOT copy NYT logo, exact branding, or scrape their word list. Use open word lists.
- Functional green/yellow/gray feedback is fine; our visual identity is our own.
- Run USPTO/EUIPO + domain search before launch.

## Local dev
```bash
docker compose up --build     # frontend http://localhost:5173, backend http://localhost:8000
```
