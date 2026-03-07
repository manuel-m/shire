# Feature: Observability and Monitoring

## Overview

The observability stack provides centralized logging, metrics collection, and monitoring dashboards across all microservices. It uses Prometheus for metrics, Loki for log aggregation, Grafana for visualization, and Grafana Alloy for telemetry collection. The stack runs as part of the containerized infrastructure and is available in both development and production environments.

**Source:** PRD Section 14, prompts0.md (Technical Constraints — observability).

---

## User Stories

1. **As an operator**, I want to monitor the health of all microservices from a single dashboard.
2. **As an operator**, I want to search and filter logs across all services to debug issues.
3. **As an operator**, I want to view API performance metrics (request rate, latency, error rate) per service.
4. **As an operator**, I want to monitor infrastructure utilization (CPU, memory, container health).
5. **As an operator**, I want to track business metrics (clients, engagements, reports, invoices) over time.
6. **As a developer**, I want the full observability stack available locally via Docker Compose.

---

## Data Model

No application-level collections. Data is stored in the observability tools:

- **Prometheus** — time-series metrics data
- **Loki** — log entries indexed by labels
- **Grafana** — dashboard configurations (provisioned via config files)

---

## Stack Components

| Component | Role | Port |
|-----------|------|------|
| Prometheus | Scrapes `/metrics` endpoints, stores time-series data | 9090 |
| Grafana | Dashboard visualization and alerting UI | 3100 |
| Loki | Log aggregation and querying | 3101 |
| Grafana Alloy | Telemetry collection agent (logs from stdout) | — |

---

## Instrumentation Requirements

Every microservice must:

1. **Expose `/metrics` endpoint** — Prometheus-format metrics using `prom-client`
2. **Emit structured JSON logs to stdout** — collected by Grafana Alloy and pushed to Loki
3. **Include standard log fields:**
   - timestamp
   - service name
   - log level (debug, info, warn, error)
   - request ID (for distributed request correlation)
   - message
   - relevant metadata

### Application Metrics

- `http_requests_total` — counter, labeled by method, path, status
- `http_request_duration_seconds` — histogram, labeled by method, path
- `http_errors_total` — counter, labeled by method, path, error type

### Business Metrics

- `clients_total` — gauge
- `engagements_total` — gauge, labeled by status, type
- `reports_generated_total` — counter
- `invoices_issued_total` — counter
- `revenue_total` — gauge (in base currency)

### Infrastructure Metrics

Collected automatically by Alloy/Prometheus:

- CPU usage per container
- Memory usage per container
- Container health status

---

## Grafana Dashboards

Pre-provisioned dashboards (stored in `infrastructure/grafana/dashboards/`):

1. **System Health** — service uptime, container resource usage, health check status
2. **API Performance** — request rates, latency percentiles (p50, p95, p99), error rates per service
3. **Business Metrics** — client count, engagement pipeline, revenue trends, invoice status distribution

Dashboards support filtering by:
- Service name
- Time period

---

## Configuration Files

```
infrastructure/
  prometheus/
    prometheus.yml          # Scrape targets for all services
  grafana/
    provisioning/
      datasources.yml       # Prometheus + Loki data sources
      dashboards.yml        # Dashboard provisioning config
    dashboards/
      system-health.json
      api-performance.json
      business-metrics.json
  loki/
    loki-config.yml         # Loki storage and retention config
  alloy/
    config.alloy            # Log collection and forwarding rules
```

---

## Business Rules

1. All services must include observability instrumentation — no service is exempt.
2. Metrics must be exposed in a standardized format across all services (consistent label names).
3. Logs must be structured JSON — no unstructured text logs.
4. Request IDs must be propagated across inter-service calls for correlation.
5. The observability stack must be available in local development via Docker Compose.

---

## Acceptance Criteria

- [ ] All services expose `/metrics` endpoint with standard application metrics
- [ ] Prometheus successfully scrapes all service metrics
- [ ] Structured JSON logs from all services appear in Loki
- [ ] Grafana dashboards render correctly with real data
- [ ] System Health dashboard shows service status and resource usage
- [ ] API Performance dashboard shows request rates, latency, and errors
- [ ] Business Metrics dashboard shows client, engagement, and revenue data
- [ ] Logs can be searched and filtered by service name, log level, and request ID
- [ ] Full stack runs locally via Docker Compose

---

## Dependencies

- **All services** — must implement instrumentation (metrics endpoint + structured logging)
- **Docker Compose** — orchestrates the observability stack alongside application services

## Future Enhancements

- **Alerting:** Grafana alerting rules for service downtime, high error rates, excessive latency, and resource exhaustion (delivered via email or messaging platforms)
- **Distributed Tracing:** OpenTelemetry integration for tracing requests across multiple services
