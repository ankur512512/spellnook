# Spellnook — common workflows. Two environments:
#   staging = local (this machine), for testing changes  -> docker-compose.yml
#   prod    = the live deployment                          -> docker-compose.prod.yml
#
# Promotion principle: build ONE image per commit and run the SAME image in both
# environments; only env/secrets differ. See docs/DEPLOYMENT.md.

COMPOSE        := docker compose
PROD_COMPOSE   := docker compose -f docker-compose.prod.yml --env-file .env.prod

.PHONY: help staging staging-down prod prod-down logs ps fetch-words smoke build-prod

help:
	@echo "staging       - run locally (hot reload) at http://localhost:5173"
	@echo "staging-down  - stop the local stack"
	@echo "fetch-words   - (re)generate full word lists for all lengths"
	@echo "smoke         - run backend smoke tests (multiplayer + auth/stats)"
	@echo "build-prod    - build production images"
	@echo "prod          - run the production-like stack at http://localhost:8080 (needs .env.prod)"
	@echo "prod-down     - stop the production stack"

# ---- Staging (local) ----
staging:
	$(COMPOSE) up --build

staging-down:
	$(COMPOSE) down

fetch-words:
	$(COMPOSE) exec backend python scripts/fetch_words.py
	$(COMPOSE) restart backend

smoke:
	$(COMPOSE) exec -e PYTHONPATH=/app -T backend python scripts/ws_smoke.py
	$(COMPOSE) exec -e PYTHONPATH=/app -T backend python scripts/auth_smoke.py

# ---- Prod ----
build-prod:
	$(PROD_COMPOSE) build

prod:
	$(PROD_COMPOSE) up -d --build

prod-down:
	$(PROD_COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps
