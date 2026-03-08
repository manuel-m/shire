# Shire

AI Consulting Back-Office Platform — an internal SaaS tool for managing consulting workflows: clients, engagements, reports, billing, and analytics.

## Architecture

Microservices behind a BFF (Backend-for-Frontend), communicating via REST over a Docker bridge network. Each service owns its MongoDB collections.

| Service            | Port | Purpose                                  |
| ------------------ | ---- | ---------------------------------------- |
| BFF Service        | 3007 | Single API entry point for the web app   |
| Auth Service       | 3001 | JWT auth, user management                |
| Client Service     | 3002 | Clients, contacts, encrypted credentials |
| Engagement Service | 3003 | Consulting engagements lifecycle         |
| Report Service     | 3004 | Report CRUD, versioning, PDF generation  |
| Billing Service    | 3005 | Invoices, payment tracking               |
| Web App            | 8888 | React SPA served via nginx               |

Zod schemas (`@shire/shared-types`) are the single source of truth — they drive runtime validation, TypeScript types, OpenAPI specs, and generated React Query hooks. See [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) for details.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Frontend:** React 19, MUI, React Query, Vite
- **Validation:** Zod + zod-to-openapi
- **Database:** MongoDB
- **API Client:** Orval (generated from OpenAPI spec)
- **Testing:** Vitest, Supertest, MongoDB Memory Server
- **Infra:** Docker, Docker Compose, pnpm workspaces
- **Observability:** Prometheus, Grafana, Loki, Grafana Alloy

## Prerequisites

- Node.js >= 20
- pnpm
- Docker & Docker Compose

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Run with Docker (production)

```bash
cd infrastructure
docker compose up --build
```

Exposed ports: web app on `8888`, BFF on `3007`, Grafana on `3100`.

### Run with Docker (development)

```bash
cd infrastructure
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Services run with hot-reload via `tsx`. Source directories are mounted as volumes. MongoDB is exposed on `27017` and Compass UI on `8080`.

### Run the web app locally

```bash
pnpm --filter @shire/web-app dev
```

Vite dev server on `http://localhost:5173`, proxying `/api` to `http://localhost:3007`.

## Developer Guide

### Common Commands

```bash
pnpm build                    # Build all packages/services
pnpm type-check               # Type-check everything
pnpm lint                     # Lint all packages
pnpm format                   # Format code with Prettier
pnpm format:check             # Check formatting
pnpm test:unit                # Run unit tests
pnpm test:integration         # Run integration tests
pnpm validate                 # type-check + lint + format:check + duplication
pnpm depcheck                 # Check for unused dependencies
pnpm duplication              # Detect code duplication (jscpd)
pnpm security                 # Run semgrep security checks
```

Target a single service:

```bash
pnpm --filter @shire/billing-service test
pnpm --filter @shire/billing-service dev
```

### API Client Generation

```bash
# 1. Generate the OpenAPI spec from the BFF service
pnpm --filter @shire/bff-service dump-openapi

# 2. Generate React Query hooks from the spec
pnpm --filter @shire/api-client generate
```

### Project Structure

```
packages/
  shared-types/     # @shire/shared-types — Zod schemas, OpenAPI helpers, TS types
  shared/           # @shire/shared — Swagger UI mount, shared registry
  api-client/       # @shire/api-client — Generated React Query hooks, fetcher
apps/
  web-app/          # React SPA (Vite + MUI)
services/
  auth-service/     # JWT auth, user management
  client-service/   # Client & contact CRUD
  engagement-service/
  report-service/   # Reports, PDF generation pipeline
  billing-service/  # Invoices, payment tracking
  bff-service/      # Backend-for-Frontend, aggregates all services
infrastructure/     # Docker Compose, Prometheus, Grafana, Loki, Alloy configs
doc/                # PRD, architecture, feature specs
```
