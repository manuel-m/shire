COMPOSE_DIR := infrastructure
COMPOSE := docker compose -f $(COMPOSE_DIR)/docker-compose.yml
COMPOSE_DEV := $(COMPOSE) -f $(COMPOSE_DIR)/docker-compose.dev.yml

.PHONY: up \
down \
dev \
dev-down \
format \
logs \
generate-js \
build \
reset \
clean \
test \
test-auth-service \
test-client-service \
test-engagement-service \
test-report-service \
test-billing-service \
test-bff-service \
verify-js \
seed \
verify \
verify-dev

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

format:
	pnpm run format

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

test: test-auth-service test-client-service test-engagement-service test-report-service test-billing-service test-bff-service

test-auth-service:
	pnpm --filter @shire/auth-service test

test-client-service:
	pnpm --filter @shire/client-service test

test-engagement-service:
	pnpm --filter @shire/engagement-service test

test-report-service:
	pnpm --filter @shire/report-service test

test-billing-service:
	pnpm --filter @shire/billing-service test

test-bff-service:
	pnpm --filter @shire/bff-service test

## Run seed container (all verify scripts inside Docker network)
seed:
	$(COMPOSE) --profile seed up seed --build --abort-on-container-exit

## Full pipeline: format + validate + test + reset + up + seed verification
verify: format verify-js test reset up seed

## Full pipeline in dev mode
verify-dev: format verify-js test reset dev seed

verify-js: generate-js
	pnpm run validate

generate-js:
	pnpm --filter @shire/bff-service dump-openapi
	pnpm --filter @shire/api-client generate
