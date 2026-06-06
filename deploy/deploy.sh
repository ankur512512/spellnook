#!/usr/bin/env bash
# Production deploy, run ON the VM (piped in by the GitHub Actions deploy job, or
# run manually). Pulls the latest main, rebuilds, and health-checks.
set -euo pipefail

REPO="${SPELLNOOK_REPO:-/home/ubuntu/spellnook-git}"
DOMAIN="${SPELLNOOK_DOMAIN:-spellnook.ankur.theworkpc.com}"

cd "$REPO"
echo "[deploy] updating $REPO to origin/main"
git fetch origin main
git checkout main 2>/dev/null || true
git reset --hard origin/main
git --no-pager log --oneline -1

cd "$REPO/deploy"
echo "[deploy] building + starting (native arm64 build on the VM)"
sudo docker-compose -f docker-compose.vm.yml --env-file .env up -d --build

echo "[deploy] health check https://$DOMAIN/api/health"
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "https://$DOMAIN/api/health" || true)
  if [ "$code" = "200" ]; then echo "[deploy] OK — health 200 after ~$((i*5))s"; exit 0; fi
  echo "[deploy] waiting (code=$code)"; sleep 5
done
echo "[deploy] FAILED — health never returned 200"
sudo docker-compose -f docker-compose.vm.yml --env-file .env ps
exit 1
