# Runbook — local dev vs VM prod

Two environments, same code, config differs only via env files.

| | Local (dev/staging) | VM (prod) |
|---|---|---|
| Compose file | `docker-compose.yml` (repo root) | `deploy/docker-compose.vm.yml` |
| Env file | `./.env` (optional) | `deploy/.env` (required, on the VM, untracked) |
| Edge / TLS | Vite dev server, plain HTTP | Caddy, auto Let's Encrypt on 443 |
| URLs | FE http://localhost:5173, BE http://localhost:8000 | https://spellnook.ankur.theworkpc.com |
| Compose CLI | `docker compose` (plugin) | `docker-compose` (v2 standalone) + `sudo` |
| Hot reload | yes | no (built images) |

---

## Local development

The defaults in `docker-compose.yml` work with **no env file** (guest multiplayer +
daily game + practice all work; Google sign-in is just disabled).

```bash
# from repo root
docker compose up --build          # or: make staging
# FE → http://localhost:5173   BE → http://localhost:8000
docker compose down                # stop  (add -v to also wipe the local DB)
```

Optional — enable Google sign-in and/or pin the JWT secret locally:
```bash
cp .env.example .env
# edit ./.env and set:
#   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com   (feeds backend + frontend)
#   SPELLNOOK_JWT_SECRET=$(openssl rand -hex 32)        (optional in dev)
docker compose up --build
```
> Add `http://localhost:5173` as an authorized JS origin on the OAuth client (docs/AUTH_SETUP.md).

First run, to load the full guess dictionary (otherwise only the curated 5-letter list):
```bash
docker compose exec backend python scripts/fetch_words.py && docker compose restart backend
```

---

## VM (prod)

`deploy/.env` already exists on the VM with generated secrets — **don't regenerate it**
(changing `POSTGRES_PASSWORD` breaks the existing DB volume; changing `SPELLNOOK_JWT_SECRET`
logs everyone out). To create it fresh elsewhere:

```bash
cd deploy && cp .env.vm.example .env
# set: POSTGRES_PASSWORD, SPELLNOOK_JWT_SECRET (openssl rand -hex 32),
#      SPELLNOOK_DOMAIN=spellnook.ankur.theworkpc.com
#      GOOGLE_CLIENT_ID=  (optional; empty = sign-in disabled)
```

Run / update:
```bash
cd /home/ubuntu/spellnook/deploy
sudo docker-compose -f docker-compose.vm.yml --env-file .env up -d --build
sudo docker-compose -f docker-compose.vm.yml logs -f --tail=100   # watch
```

---

## Deploy flow: local → GitHub → VM (git pull + deploy key)

**One-time, on the VM** — create a read-only deploy key and clone:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/spellnook_deploy -N ""
cat ~/.ssh/spellnook_deploy.pub        # → add to GitHub repo: Settings ▸ Deploy keys (read-only)

cat >> ~/.ssh/config <<'CFG'
Host github-spellnook
  HostName github.com
  User git
  IdentityFile ~/.ssh/spellnook_deploy
  IdentitiesOnly yes
CFG

# clone into a fresh dir, then carry over the existing secrets file
git clone github-spellnook:<you>/spellnook.git ~/spellnook-git
cp /home/ubuntu/spellnook/deploy/.env ~/spellnook-git/deploy/.env   # keep working secrets!
# (then use ~/spellnook-git as the live dir, or move it to /home/ubuntu/spellnook)
```

**Each deploy:**
```bash
cd ~/spellnook-git
git pull
sudo docker-compose -f deploy/docker-compose.vm.yml --env-file deploy/.env up -d --build
```

Notes:
- `.env` / `.env.*` are git-ignored (only `.env.example` / `.env.vm.example` are committed), so
  pulls never touch your secrets.
- Prefer a deploy key over `ssh -A` agent forwarding (repo-scoped, read-only, unattended-safe).
- Later: build images in CI → push to GHCR → on the VM `docker-compose pull && up -d`
  (no building on the arm64 VM). See `.github/workflows/ci.yml`.

## Common ops (VM)
```bash
sudo docker-compose -f deploy/docker-compose.vm.yml ps                 # status
sudo docker-compose -f deploy/docker-compose.vm.yml restart backend    # restart one
sudo docker-compose -f deploy/docker-compose.vm.yml exec backend python scripts/fetch_words.py
```
