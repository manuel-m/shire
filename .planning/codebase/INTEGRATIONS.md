# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**None detected.**

The codebase uses no external third-party APIs (no Stripe, AWS, Twilio, SendGrid, etc.). All communication is internal between microservices over the Docker bridge network.

## Data Storage

**Databases:**
- MongoDB 7
  - Connection: `MONGODB_URI` environment variable (per-service databases: `shire-auth`, `shire-client`, `shire-engagement`, `shire-report`, `shire-billing`)
  - Client: MongoDB Node.js Driver (`mongodb` package)
  - Deployment: Single MongoDB instance with per-service databases

**File Storage:**
- Local filesystem only
  - Backup snapshots: `infrastructure/backup/` directory
  - Volume mounted: `mongodb-data` Docker volume

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: Auth Service (`services/auth-service/`)
  - JWT library: `jsonwebtoken`
  - Password hashing: `bcrypt`
  - Token storage: In-memory refresh tokens (max 5 per user)
  - Flow: Access token (15min expiry) + Refresh token (7 days)
  - Frontend: Access token in memory, refresh token in `localStorage`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Bugsnag, etc.)

**Logs:**
- Approach: Structured JSON logs to stdout
- Aggregation: Grafana Loki 3.1.0
- Collector: Grafana Alloy 1.3.0 (Docker log driver integration)
- Log format: `timestamp`, `service`, `level`, `message`, `requestId`, `metadata`

**Metrics:**
- Framework: Prometheus 2.53.0
- Collection: `prom-client` library per service
- Scrape: Prometheus polls `/metrics` endpoint on each service
- Metrics: HTTP request duration histogram, request counter, default Node.js metrics
- Visualization: Grafana 11.1.0 dashboards
- Data retention: 15 days (Prometheus), 168h (Loki)

## CI/CD & Deployment

**Hosting:**
- Platform: Docker containers (self-hosted)
- Orchestrator: Docker Compose
- Network: Docker bridge network (`shire-network`)

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)
- Manual deployment via `Makefile` targets

**Service Discovery:**
- Docker Compose service names (e.g., `auth-service`, `client-service`)
- Internal HTTP communication via service names on bridge network

## Environment Configuration

**Required env vars:**

**Auth Service:**
- `AUTH_SERVICE_PORT` (default: 3001)
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (default: 15m)
- `REFRESH_TOKEN_EXPIRES_IN_DAYS` (default: 7)
- `BCRYPT_ROUNDS` (default: 12)

**Client Service:**
- `CLIENT_SERVICE_PORT` (default: 3002)
- `MONGODB_URI`
- `JWT_SECRET`
- `CREDENTIALS_ENCRYPTION_KEY`

**Engagement Service:**
- `ENGAGEMENT_SERVICE_PORT` (default: 3003)
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_SERVICE_URL` (default: http://client-service:3002)

**Report Service:**
- `REPORT_SERVICE_PORT` (default: 3004)
- `MONGODB_URI`
- `JWT_SECRET`
- `ENGAGEMENT_SERVICE_URL` (default: http://engagement-service:3003)
- `CLIENT_SERVICE_URL` (default: http://client-service:3002)

**Billing Service:**
- `BILLING_SERVICE_PORT` (default: 3005)
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_SERVICE_URL` (default: http://client-service:3002)
- `ENGAGEMENT_SERVICE_URL` (default: http://engagement-service:3003)

**BFF Service:**
- `BFF_SERVICE_PORT` (default: 3007)
- `JWT_SECRET`
- `AUTH_SERVICE_URL` (default: http://auth-service:3001)
- `CLIENT_SERVICE_URL` (default: http://client-service:3002)
- `ENGAGEMENT_SERVICE_URL` (default: http://engagement-service:3003)
- `REPORT_SERVICE_URL` (default: http://report-service:3004)
- `BILLING_SERVICE_URL` (default: http://billing-service:3005)

**Global/Infrastructure:**
- `MONGO_PASSWORD` (default: password) - MongoDB root user
- `GRAFANA_ADMIN_PASSWORD` (default: admin)

**Secrets location:**
- Environment variables only (`.env` file, never committed)
- No secrets management service (Vault, AWS Secrets Manager)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Internal Service Communication

**Inter-service REST API:**
- BFF Service proxies to downstream services (auth, client, engagement, report, billing)
- Services fetch from each other using native `fetch()` API
- Authentication: Bearer token passed in `Authorization` header
- Request tracing: `X-Request-Id` header forwarded through request chain

**Service Endpoints (internal):**
- Auth Service: `http://auth-service:3001`
- Client Service: `http://client-service:3002`
- Engagement Service: `http://engagement-service:3003`
- Report Service: `http://report-service:3004`
- Billing Service: `http://billing-service:3005`
- BFF Service: `http://bff-service:3007`

**Exposed Ports (host):**
- BFF Service: 3007 (API gateway)
- MongoDB: 27017 (dev mode only)
- Grafana: 3100 (dashboard)
- Web App: 8888 (via nginx)
- Compass Web: 8080 (MongoDB GUI, dev mode only)

---

*Integration audit: 2026-03-10*
