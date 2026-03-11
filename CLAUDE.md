# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shire is an AI Consulting Back-Office Platform — an internal SaaS tool for managing consulting workflows (clients, engagements, reports, billing, analytics). Built as a microservices architecture with Node.js/TypeScript.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Validation:** Zod (schemas are the single source of truth for types)
- **Database:** MongoDB
- **Testing:** Vitest (preferred), Supertest for HTTP, MongoDB Memory Server for integration tests
- **Infrastructure:** Docker, Docker Compose
- **Monorepo:** pnpm workspaces
- **Observability:** Prometheus (metrics), Grafana (dashboards), Loki (logs), Grafana Alloy (telemetry collector)

## Architecture

Seven microservices behind an API Gateway, communicating via synchronous REST over a Docker bridge network (`shire-network`). Each service owns its MongoDB collections.

| Service            | Port | Purpose                                          |
| ------------------ | ---- | ------------------------------------------------ |
| API Gateway        | 3000 | Routing, JWT validation, rate limiting           |
| Auth Service       | 3001 | JWT auth, user management                        |
| Client Service     | 3002 | Clients, contacts, encrypted code credentials    |
| Engagement Service | 3003 | Consulting engagements lifecycle                 |
| Report Service     | 3004 | Report CRUD, versioning, PDF generation pipeline |
| Billing Service    | 3005 | Invoices, payment tracking                       |
| Analytics Service  | 3006 | Dashboard metrics aggregation                    |

Inter-service calls use Docker Compose service names (e.g., `http://client-service:3002`). Only API Gateway and Grafana expose ports to the host.

## Repository Structure

```
packages/shared-types/    # @shire/shared-types — Zod schemas + inferred TS types
services/
  api-gateway/
  auth-service/
  client-service/
  engagement-service/
  report-service/
  billing-service/
  analytics-service/
infrastructure/           # Docker Compose, Prometheus, Grafana, Loki, Alloy configs
doc/                      # PRD, architecture, feature specs
```

## Common Commands

```bash
pnpm install                    # Install all dependencies
pnpm -r build                  # Build all packages/services
pnpm -r type-check             # Type-check everything
pnpm -r lint                   # Lint all packages
pnpm -r test:unit              # Run unit tests across all services
pnpm -r test:integration       # Run integration tests
pnpm --filter <service> test   # Run tests for a single service
```

## Key Conventions

- **Types-first:** Define Zod schemas in `packages/shared-types/`, infer TypeScript types with `z.infer<>`. Never duplicate type definitions across services.
- **Import shared types as** `@shire/shared-types`
- **API conventions:** REST, JSON request/response, pagination via `?page=1&limit=20`, errors as `{ "error": { "code": string, "message": string } }`
- **Auth:** Bearer JWT in Authorization header, validated by API Gateway delegating to Auth Service
- **Every service must:** expose `/metrics` (Prometheus format via `prom-client`), emit structured JSON logs to stdout (timestamp, service name, log level, request ID, message, metadata)
- **Report generation pipeline:** Structured JSON → Markdown (Handlebars) → HTML (with CSS) → PDF (Puppeteer)
- **Code credentials** (SSH keys, tokens) in Client Service must be encrypted at rest with access logging

## Testing

- 80% coverage on service logic, 100% on API endpoints and Zod schemas
- Contract tests for all inter-service calls
- Use MongoDB Memory Server for integration tests (no external DB dependency)
