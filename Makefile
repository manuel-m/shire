COMPOSE_DIR := infrastructure
COMPOSE := docker compose -f $(COMPOSE_DIR)/docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f $(COMPOSE_DIR)/docker-compose.dev.yml

.PHONY: up down dev dev-down logs build reset clean test test-auth-service test-client-service verify-js verify-auth verify-logs verify-client verify

## Start all services (production-like)
up:
	$(COMPOSE) up --build -d

## Stop all services
down:
	$(COMPOSE) down

## Start in dev mode (hot-reload, exposed MongoDB)
dev:
	$(COMPOSE_DEV) up --build -d

## Stop dev mode
dev-down:
	$(COMPOSE_DEV) down

## Tail logs (pass SVC= to filter, e.g. make logs SVC=auth-service)
logs:
	$(COMPOSE) logs -f $(SVC)

## Build images without starting
build:
	$(COMPOSE) build

## Stop services and destroy all volumes (database, metrics, logs)
reset:
	$(COMPOSE) down -v

## Remove stopped containers, dangling images, and volumes
clean:
	$(COMPOSE) down -v --rmi local --remove-orphans

test: test-auth-service test-client-service

test-auth-service:
	pnpm --filter @shire/auth-service test

test-client-service:
	pnpm --filter @shire/client-service test

## Full verification: reset state, start stack, run all checks
verify: verify-js test reset up verify-auth verify-logs verify-client

verify-js:
	pnpm run validate

## Run auth-service verification against a live stack (make reset && make up first)
verify-auth:
	./scripts/verify-auth.sh

## Verify logs are flowing through Loki (run after verify-auth)
verify-logs:
	./scripts/verify-logs.sh

verify-client:
	./scripts/verify-client.sh