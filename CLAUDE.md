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

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
