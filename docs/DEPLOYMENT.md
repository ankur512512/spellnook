# Deployment & architecture notes

## Environments: staging (local) + prod (live)
- **staging = local** (`docker-compose.yml`): your machine, hot reload, for testing
  changes. `make staging`. Backend reports `environment: staging`.
- **prod = live** (`docker-compose.prod.yml`): built images, nginx serves the SPA and
  proxies `/api` + `/ws`. `make prod` (needs `.env.prod`). Backend reports `environment: prod`.

**The same code/image runs in both — only config differs**, injected via env:
- Backend: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `SPELLNOOK_JWT_SECRET`, `CORS_ALLOW_ORIGINS`, `ENVIRONMENT`.
- Frontend: **runtime config** — `/config.js` is generated at container start from
  `SPELLNOOK_GOOGLE_CLIENT_ID` / `SPELLNOOK_API_URL` (see `frontend/docker-entrypoint.d/`).
  This is why a single frontend image is environment-agnostic (no rebuild per env).

Config lives in `.env` (staging) / `.env.prod` (prod), templated by `.env.example`. Never commit secrets.

## Branch & promotion strategy (staging / prod branches)
Your two-branch plan works; to keep promotion clean and avoid drift:
1. Merge feature PRs into **`staging`** → CI runs → deploy to the staging (local) env.
2. Promote by PR/merge **`staging` → `prod`** (ideally fast-forward).
3. **CI builds one image per commit, tagged by SHA**; deploy that *same* tag to staging,
   then promote the *same* tag to prod — do **not** rebuild per branch.
4. Only `.env`/secrets differ between environments. No env-specific code or builds.

Pitfalls this avoids: branch drift, messy back-merges, hotfix cherry-pick pain, and
"worked in staging, different in prod" from separate rebuilds.

## CI/CD pipeline
**Branch model:** `staging` (default; local dev + integration) and `main` (production).
Develop on `staging`, run locally, then open a PR / merge `staging -> main` to ship.

- **`.github/workflows/ci.yml`** (push to staging/main + PRs): frontend build (tsc strict +
  vite), backend smoke tests (auth/stats + multiplayer) against a Postgres service, Dockerfile build.
- **`.github/workflows/deploy.yml`** (push to `main`): waits for **manual approval** (the
  `production` GitHub Environment), then SSHes into the VM and runs `deploy/deploy.sh`
  (`git reset --hard origin/main` → `docker-compose up -d --build` → health check).
  We **build on the VM** (native arm64, fast) rather than cross-building in CI under QEMU.

### One-time GitHub setup (repo owner)
1. **Secrets** (Settings ▸ Secrets and variables ▸ Actions):
   - `VM_HOST` = `ankur.theworkpc.com`
   - `VM_USER` = `ubuntu`
   - `VM_SSH_KEY` = the CI deploy **private key** (its public key is already in the VM's
     `~/.ssh/authorized_keys`).
2. **Environment** (Settings ▸ Environments ▸ New ▸ `production`): add yourself under
   **Required reviewers** — this is the manual approval gate before each prod deploy.
3. **Default branch** = `staging` (Settings ▸ Branches).
4. *(Optional)* Protect `main`: require PR + passing CI before merge.

### Day-to-day
```
git switch staging && <edit> && docker compose up --build   # develop + test locally
git push origin staging                                      # CI runs
# open PR staging -> main, merge  →  deploy.yml waits for your approval  →  deploys to prod
```
Manual deploy from the VM is still available: `bash /home/ubuntu/spellnook-git/deploy/deploy.sh`.


## CPU architecture (amd64 + arm64)
All base images are official **multi-arch** manifests that include `linux/arm64`
and `linux/amd64`, so the same `docker compose` works unchanged on an aarch64 VM —
Docker pulls the matching architecture automatically:

- `postgres:18-alpine`, `python:3.12-slim`, `node:22-alpine`, `nginx:1.27-alpine` — all arm64 ✓

Native Python/Node deps also ship arm64 artifacts (asyncpg, pydantic-core, uvloop,
esbuild, rollup), so image builds work natively on arm64 — no emulation. We deliberately
**do not** pin `platform:` in compose, and we don't commit a `package-lock.json`, which
avoids the npm cross-arch optional-dependency pitfall.

> If you build images on one arch and run on another, use `docker buildx build
> --platform linux/amd64,linux/arm64` to publish a multi-arch image.

## Database: self-hosted vs managed
- **Dev / local:** the `db` Postgres container (in `docker-compose.yml`) is the right
  choice — zero setup, disposable.
- **Prod:** recommend **managed Postgres (GCP Cloud SQL**, or AlloyDB) rather than a
  container on the VM. The dataset here is small (one row per finished game), so this
  isn't about *size* — it's about **ops**: automated backups, point-in-time recovery,
  patching, failover, and not babysitting a stateful container. The smallest Cloud SQL
  tier is plenty for launch.
- Switching is **env-only, no code change**: point `DATABASE_URL` at the managed
  instance, e.g.
  `postgresql+asyncpg://user:pass@/spellnook?host=/cloudsql/PROJECT:REGION:INSTANCE`
  (via the Cloud SQL Auth Proxy / connector), and drop the `db` service from the prod
  compose. Keep secrets in Secret Manager, not in compose.
- If you'd rather self-host on the VM initially (cost), that's fine for low traffic —
  but add automated `pg_dump` backups + restore drills before launch.

## Postgres version
- We pin **Postgres 18** (latest). 16 earlier was just a conservative default, not a
  requirement — bumped since this is greenfield with a trivial schema.
- **Keep dev and prod on the same major version.** When you provision Cloud SQL, pick
  the major it offers; if it doesn't yet offer 18, set both dev and prod to 17 (change
  the one `image:` line + the Cloud SQL tier). Major-version pin lives in both compose files.
- **Major upgrades are not in-place:** a data directory initialized by an older major
  won't boot on a newer one. For dev, recreate the volume (`docker compose down -v`).
  For prod, use the managed service's upgrade path or `pg_dump`/restore — never just
  bump the tag on a populated volume.
