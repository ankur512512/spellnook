# Google Sign-In setup (Phase 6b)

Spellnook uses the **Google Identity Services ID-token flow**. The backend only
needs the *public* OAuth Client ID (no client secret). Works on `localhost` for
development — no domain or HTTPS required.

## 1. Create an OAuth Client ID (Google Cloud Console)
1. Go to https://console.cloud.google.com/ → create/select a project.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**, fill app name + support email, save.
   - Leave it in **Testing** mode and add your Google account under **Test users**.
     (Testing mode needs no verification; only listed test users can sign in.)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** `http://localhost:5173`
     (add your prod origin later, e.g. `https://play.spellnook.com`).
   - Authorized redirect URIs: not required for the ID-token (GIS button) flow.
   - Create → copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`).

## 2. Provide it to the app
Create a `.env` file at the repo root (git-ignored) — docker-compose reads it:

```bash
# .env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com        # backend verifies tokens
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com    # frontend renders the button
SPELLNOOK_JWT_SECRET=$(openssl rand -hex 32)              # signs our own session JWTs
```

Both `*_CLIENT_ID` values are the **same** Client ID. The JWT secret is ours
(not Google's) and must be a strong random value in prod.

## 3. Run
```bash
docker compose up --build      # Stats tab now shows the Google sign-in button
```

If the IDs are unset the app still runs — guest multiplayer and the daily game
work; the Stats tab just shows a "not configured" hint.

## How it works
- Frontend renders the Google button; on success it gets a signed **ID token**.
- `POST /api/auth/google {credential}` → backend verifies the token against
  Google's public keys + our Client ID, upserts the `users` row, and returns our
  **JWT** (30-day). The frontend stores it and sends `Authorization: Bearer <jwt>`.
- Multiplayer passes the JWT on the WS connect (`?token=`) so finished rounds are
  attributed to the signed-in player.

## Security notes / hardening TODO
- The JWT is stored in `localStorage` (bearer). For prod, consider an **httpOnly
  cookie** to reduce XSS token theft (adds CSRF handling).
- Replace startup `create_all` with **Alembic** migrations.
- Restrict backend CORS to known origins (currently `*` for dev).
- Set a strong `SPELLNOOK_JWT_SECRET` and real Postgres credentials via secrets.
