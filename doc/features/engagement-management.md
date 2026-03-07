# Feature: Engagement Management

## Overview

The Engagement Service manages consulting missions (engagements) linked to clients. Each engagement tracks its type, how the consultant accesses the client's system, current status, priority, and timeline. Engagements are the central workflow entity connecting clients to reports and invoices.

**Source:** PRD Section 5.2, prompts0.md (Requests / Engagements).

---

## User Stories

1. **As a consultant**, I want to create an engagement for a client so that I can track the consulting mission.
2. **As a consultant**, I want to specify the access type (black-box, code-delivery, code-credentials) so that the engagement reflects how I interact with the client's system.
3. **As a consultant**, I want to update the engagement status as work progresses.
4. **As a consultant**, I want to assign an engagement to a specific consultant.
5. **As a consultant**, I want to view all engagements for a client.
6. **As a consultant**, I want to filter engagements by status, type, and priority.
7. **As a consultant**, I want the creation date to be automatically set and immutable.

---

## Data Model

### Engagements Collection

```typescript
const EngagementSchema = z.object({
  _id: z.string(),
  clientId: z.string(),
  type: z.enum(['diagnostic', 'support', 'resolution']),
  accessType: z.enum(['black-box', 'code-delivery', 'code-credentials']),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['requested', 'diagnosis', 'in-progress', 'waiting-for-client', 'completed']),
  assignedConsultant: z.string().optional(),
  timeline: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    estimatedHours: z.number().optional(),
  }).optional(),
  creationDate: z.date(),  // immutable, set at creation
  updatedAt: z.date(),
});
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /engagements | Create engagement |
| GET | /engagements | List engagements (paginated, filterable) |
| GET | /engagements/:id | Get engagement details |
| PUT | /engagements/:id | Update engagement |
| PATCH | /engagements/:id/status | Update engagement status |
| DELETE | /engagements/:id | Delete engagement |
| GET | /engagements/client/:clientId | Get engagements by client |

---

## Business Rules

1. `clientId` must reference an existing client (validated via Client Service).
2. `creationDate` is set automatically at creation and cannot be modified.
3. Status transitions follow this order: `requested` → `diagnosis` → `in-progress` → `waiting-for-client` ↔ `in-progress` → `completed`.
4. `accessType` of `code-credentials` requires the associated client to have `codeCredentials` stored.
5. An engagement cannot be deleted if it has associated reports or invoices.
6. `type` cannot be changed after creation.
7. When status changes to `completed`, `timeline.endDate` is automatically set if not already present.

---

## Acceptance Criteria

- [ ] CRUD operations work for engagements
- [ ] `creationDate` is immutable after creation
- [ ] `accessType` is required and validated against the enum
- [ ] Invalid status transitions return 422
- [ ] Creating an engagement with a non-existent `clientId` returns 404
- [ ] Filtering by status, type, priority, and clientId works
- [ ] Deleting an engagement with reports or invoices returns 409

---

## Dependencies

- **Client Service** — validates `clientId` on creation
- **Consumed by:** Report Service, Billing Service, Analytics Service
