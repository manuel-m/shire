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
  timeline: z
    .object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      estimatedHours: z.number().optional(),
    })
    .optional(),
  creationDate: z.date(), // immutable, set at creation
  updatedAt: z.date(),
});
```

---

## API Endpoints

| Method | Path                          | Description                              |
| ------ | ----------------------------- | ---------------------------------------- |
| POST   | /engagements                  | Create engagement                        |
| GET    | /engagements                  | List engagements (paginated, filterable) |
| GET    | /engagements/:id              | Get engagement details                   |
| PUT    | /engagements/:id              | Update engagement                        |
| PATCH  | /engagements/:id/status       | Update engagement status                 |
| DELETE | /engagements/:id              | Delete engagement                        |
| GET    | /engagements/client/:clientId | Get engagements by client                |

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

## How to Verify

Start the service:

```bash
pnpm --filter @shire/engagement-service dev
```

First, get a JWT token from the auth service (or craft one for local dev):

```bash
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({userId:'u1',email:'dev@test.com',role:'consultant'},'dev-secret-change-me'))")
```

Ensure a client exists (via client-service on port 3002) and note its `_id` as `<clientId>`.

1. **Create an engagement:**

   ```bash
   curl -s -X POST http://localhost:3003/engagements \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"clientId":"<clientId>","type":"diagnostic","accessType":"black-box","description":"Security audit","priority":"high"}'
   ```

   Expected: `201` with the created engagement, `status` set to `requested`. Save the `_id`.

2. **Create with non-existent client (404):**

   ```bash
   curl -s -X POST http://localhost:3003/engagements \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"clientId":"non-existent","type":"diagnostic","accessType":"black-box","description":"Test","priority":"low"}'
   ```

   Expected: `404` with `CLIENT_NOT_FOUND`.

3. **Create with code-credentials but no credentials stored (422):**

   ```bash
   curl -s -X POST http://localhost:3003/engagements \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"clientId":"<clientId>","type":"support","accessType":"code-credentials","description":"Needs creds","priority":"medium"}'
   ```

   Expected: `422` with `MISSING_CREDENTIALS` (unless the client has credentials stored).

4. **List engagements with filters:**

   ```bash
   curl -s "http://localhost:3003/engagements?status=requested&type=diagnostic&priority=high&page=1&limit=10" \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with paginated response.

5. **Get engagement by ID** (replace `<id>`):

   ```bash
   curl -s http://localhost:3003/engagements/<id> \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with engagement details.

6. **Get engagements by client:**

   ```bash
   curl -s http://localhost:3003/engagements/client/<clientId> \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with array of engagements for that client.

7. **Update an engagement:**

   ```bash
   curl -s -X PUT http://localhost:3003/engagements/<id> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"description":"Updated security audit","priority":"critical"}'
   ```

   Expected: `200` with updated engagement. `type` and `creationDate` unchanged.

8. **Valid status transition (requested → diagnosis):**

   ```bash
   curl -s -X PATCH http://localhost:3003/engagements/<id>/status \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status":"diagnosis"}'
   ```

   Expected: `200` with `status: "diagnosis"`.

9. **Invalid status transition (422):**

   ```bash
   curl -s -X PATCH http://localhost:3003/engagements/<id>/status \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status":"completed"}'
   ```

   Expected: `422` with `INVALID_STATUS_TRANSITION` (cannot jump from `diagnosis` to `completed`).

10. **Complete the workflow** (diagnosis → in-progress → completed):

    ```bash
    curl -s -X PATCH http://localhost:3003/engagements/<id>/status \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"status":"in-progress"}'
    curl -s -X PATCH http://localhost:3003/engagements/<id>/status \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"status":"completed"}'
    ```

    Expected: `200` on both. Final response has `status: "completed"` and `timeline.endDate` auto-set.

11. **Delete an engagement:**

    ```bash
    curl -s -X DELETE http://localhost:3003/engagements/<id> \
      -H "Authorization: Bearer $TOKEN"
    ```

    Expected: `204`. Returns `409` if the engagement has associated reports or invoices.

12. **Health check:**

    ```bash
    curl -s http://localhost:3003/health
    ```

    Expected: `{"status":"ok","service":"engagement-service"}`.

13. **Metrics endpoint:**
    ```bash
    curl -s http://localhost:3003/metrics
    ```
    Expected: Prometheus-format metrics output.

---

## Dependencies

- **Client Service** — validates `clientId` on creation
- **Consumed by:** Report Service, Billing Service, Analytics Service
