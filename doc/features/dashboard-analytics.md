# Feature: Dashboard and Analytics

## Overview

The Analytics Service aggregates data from all other services to provide a business performance dashboard. It tracks key metrics including client counts, engagement activity, revenue, outstanding invoices, and monthly activity summaries.

**Source:** PRD Section 5.6, prompts0.md (Dashboard).

---

## User Stories

1. **As a consultant**, I want to see the number of active clients at a glance.
2. **As a consultant**, I want to see how many engagements are currently open.
3. **As a consultant**, I want to see the number of completed diagnostics.
4. **As a consultant**, I want to see monthly and total revenue.
5. **As a consultant**, I want to see outstanding (unpaid) invoices.
6. **As a consultant**, I want to see a monthly activity summary (engagement status changes + reports created + invoices issued in the current month).

---

## Data Model

### Metrics Snapshots Collection

```typescript
const MetricsSnapshotSchema = z.object({
  _id: z.string(),
  timestamp: z.date(),
  metrics: z.object({
    activeClients: z.number(),
    openEngagements: z.number(),
    completedDiagnostics: z.number(),
    monthlyRevenue: z.number(),
    totalRevenue: z.number(),
    outstandingInvoices: z.number(),
    monthlyActivity: z.object({
      engagementStatusChanges: z.number(),
      reportsCreated: z.number(),
      invoicesIssued: z.number(),
    }),
  }),
});
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /analytics/dashboard | Get all dashboard metrics |
| GET | /analytics/revenue | Get revenue breakdown (monthly, total, by client) |
| GET | /analytics/activity | Get monthly activity summary |
| GET | /analytics/clients | Get client statistics |

---

## Business Rules

1. Dashboard metrics are computed on-demand by querying other services, with optional periodic snapshots for historical tracking.
2. "Active clients" = clients with at least one non-completed engagement.
3. "Open engagements" = engagements with status not equal to `completed`.
4. "Completed diagnostics" = engagements with type `diagnostic` and status `completed`.
5. "Monthly revenue" = sum of `paid` invoices where `paidDate` falls in the current month.
6. "Total revenue" = sum of all `paid` invoices.
7. "Outstanding invoices" = count of invoices with status `issued`, `pending-payment`, or `overdue`.
8. "Monthly activity" = count of engagement status changes + reports created + invoices issued in the current calendar month.

---

## Acceptance Criteria

- [ ] Dashboard endpoint returns all required metrics
- [ ] Revenue calculations are accurate based on paid invoices
- [ ] Active client count correctly excludes clients with only completed engagements
- [ ] Monthly activity correctly aggregates events from the current month
- [ ] Revenue breakdown supports filtering by time period
- [ ] Metrics are consistent with data from source services

---

## Dependencies

- **Client Service** — client counts
- **Engagement Service** — engagement counts and status data
- **Report Service** — report creation counts
- **Billing Service** — invoice data for revenue and outstanding calculations
