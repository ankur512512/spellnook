# Spellnook — Progress

Living checklist. Update as we go so we keep context cheap across sessions.

## Phase 1 — Scaffold + Docker
- [x] Repo structure (frontend / backend / docs)
- [x] FastAPI backend skeleton + `/api/health`
- [x] React+TS+Vite frontend skeleton
- [x] docker-compose dev (hot reload) + Dockerfiles
- [x] prod compose + nginx (serves FE, proxies /api)

## Phase 2 — Core game (FE)
- [x] 6x5 board + Tile component
- [x] On-screen keyboard + physical keyboard input
- [x] Current-row typing, backspace, enter
- [x] Win/lose flow + simple message toast

## Phase 3 — Word logic (BE)
- [x] Answer + allowed word lists (curated MVP set)
- [x] Deterministic daily word (days-since-epoch mod len)
- [x] `POST /api/guess` validation + per-letter statuses
- [ ] Swap curated lists for full open-source list (dwyl/english-words) — TODO

## Phase 4 — Polish
- [x] Flip reveal animation + invalid-row shake (basic)
- [x] Dark/light theme toggle (localStorage + OS preference, `useTheme.ts`)
- [ ] Stats modal (win distribution, streak)
- [ ] Share grid (emoji squares)
- [ ] localStorage persistence of today's game
- [ ] Hard mode toggle

## Phase 5 — Hardening
- [ ] pytest (backend), vitest/RTL (frontend)
- [ ] env config (VITE_API_URL etc.)
- [ ] CI pipeline (GitLab)
- [ ] Alembic migrations (replace startup create_all)
- [ ] httpOnly-cookie auth (replace localStorage bearer); restrict CORS to known origins

## Phase 6 — Features (differentiation)
- [x] Variable word length 4–7 (gameId = `date:length`, maxGuesses = length+1, responsive board, length selector UI)
- [x] Multiplayer race (guest, WebSockets): create/join room by code, host starts, same word,
      live opponent progress (letterless mini-boards), rank by guesses-then-time. In-memory rooms.
      Backend `multiplayer.py` + `/ws/room/{code}` + `POST /api/room`; FE `multiplayer/` (mpStore + UI).
  - [x] Mandatory + visible display names (persisted); own name shown above board.
  - [x] Max 6 players (server constant `MAX_PLAYERS`); room shows count N/6; full/in-progress rejected.
  - [x] Mobile layout: opponents in a horizontal scroll strip; tap an opponent to enlarge (overlay).
  - [x] Session persistence: stable client id (localStorage) + reconnect preserves progress across
        refresh; round counter prevents board wipe on reconnect; grace cleanup of abandoned rooms (60s).
  - [x] Fixed board sizing bug (flex collapse) — `.board` width now deterministic from `--cols`.
  - [x] Viewport fit (no page scroll): `100dvh` app, vh-scaled `--tile-size`, pinned keyboard,
        scrollable `.race-body`, compacted opponent strip (12px). Fixed Enter-key label overlap.
  - [x] Opponents collapsed to chips (name + latest row + N/max); full grid on tap (overlay).
        Thin scrollbar fallback for extreme cases. Removes the laptop scrollbar.
- [x] Google OAuth + accounts/stats/leaderboard (Phase 6b): Postgres (`db` service) + async SQLAlchemy
      (`User`, `GameResult`); Google Identity Services ID-token flow → backend verify → our JWT bearer.
      Endpoints: `/api/auth/google`, `/api/me` (+stats), `/api/results`, `/api/leaderboard`. Solo daily
      results recorded; multiplayer results attributed via WS `?token=`. FE: `src/auth/` (store, Google
      button, Stats tab w/ profile + guess distribution + leaderboard). Gated on `*_GOOGLE_CLIENT_ID`
      env (app runs without it). Setup: docs/AUTH_SETUP.md. Stats verified via `scripts/auth_smoke.py`.
- [ ] Unlimited / practice mode
- [ ] Timed / Blitz mode + leaderboard
- [ ] Hint economy; daily modifiers
- [ ] Multiplayer hardening: Redis-backed rooms (replace in-memory), disconnect-grace tuning, spectators,
      vertical fit for 7-letter boards on small screens

## Phase 7 — Environment & deployment readiness (staging + prod)
- [x] Runtime frontend config (`/config.js` injected at container start) so ONE image runs in any
      env — `src/config.ts`, `public/config.js`, `frontend/docker-entrypoint.d/40-spellnook-config.sh`.
- [x] Backend env-driven: `ENVIRONMENT`, `CORS_ALLOW_ORIGINS` (health echoes environment).
- [x] Env templates `.env.example`; `.env*` gitignored; `Makefile` (staging/prod/smoke/fetch-words).
- [x] Compose: `docker-compose.yml` = staging (local), `docker-compose.prod.yml` = prod (env-injected, PG18).
- [x] GitHub Actions CI (`.github/workflows/ci.yml`): FE build, BE smoke (auth+multiplayer) on Postgres, image build.
- [x] Branch/promotion strategy + 12-factor config documented in `docs/DEPLOYMENT.md`.
- [x] Verified: prod compose serves `:8080`, health `environment:prod`, `/config.js` runtime-injected.
- [ ] (Follow-up) publish SHA-tagged multi-arch images + actual deploy step to the VM.

## Phase 8 — UX + monetization
- [x] Daily replay-lock: each day's game persisted per `gameId` (date+length) in localStorage —
      finished puzzle stays finished ("come back tomorrow"); in-progress survives refresh. (`store.ts`)
- [x] Mobile haptics (invalid + win); slower/smoother flip reveal (3D perspective + eased).
- [ ] **Multiplayer free-games limit (proposed):** 5 games/day for signed-in AND guest users; beyond
      that requires payment (gateway later). Design:
  - Identity: signed-in → `user_id`; guest → the existing localStorage `cid` (sent on WS connect).
  - Count server-side per identity per day (new table `mp_plays` or reuse `game_results mode=multi`
    with `puzzle_date`); enforce on room create/start; return `limit_reached` → frontend shows paywall stub.
  - Word variety: room answers already random per game; ensure no repeat within a user's daily 5.
  - Guests are weakly identified (clearable localStorage) — acceptable pre-payment; real enforcement
    comes with accounts/payment.

## 🚩 Launch gate (before going public)
- [x] Own visual identity: distinct blue/amber/slate palette (colorblind-friendlier) + rounded tiles.
- [x] Privacy policy page (`frontend/public/privacy.html` → /privacy.html) + Home footer link.
- [x] Light abuse hardening: global `MAX_ROOMS` cap (503 when full).
- [ ] **(User)** Publish the Google OAuth consent screen (Testing→Production) so the public can
      sign in; set Homepage + Privacy URL (`/privacy.html`). Update the privacy contact email.
- [ ] **(User)** Trademark (USPTO/EUIPO) + domain clearance for "Spellnook".
- [ ] **(User)** Confirm no copied NYT assets / word lists (we use open word lists + own palette).
- [ ] Accounts + persisted stats (Postgres)
- [ ] Redis for live game/daily word
- [ ] Custom animations / themes

## Notes / decisions
- 2026-05-31: Named **Spellnook**. Stack = FastAPI + React/TS/Vite + Docker.
- MVP keeps answer server-side; client only learns answer on win/final guess.
