# Feature: Report Management

## Overview

The Report Service handles creation, versioning, and generation of consulting reports. Reports are stored as structured JSON data and can be rendered into Markdown and PDF documents through a templating pipeline. Each report is linked to an engagement and a client.

**Source:** PRD Sections 5.3 and 5.4, prompts0.md (Reports, Report System).

---

## User Stories

1. **As a consultant**, I want to create a report for an engagement so that I can document my findings.
2. **As a consultant**, I want to edit the structured data of a report (problems, recommendations, action plan).
3. **As a consultant**, I want reports to be versioned so that I can track changes over time.
4. **As a consultant**, I want to generate a Markdown version of a report for quick review.
5. **As a consultant**, I want to generate a professional PDF report with company branding, headers, and pagination.
6. **As a consultant**, I want to view previous versions of a report.

---

## Data Model

### Reports Collection

```typescript
const ReportSchema = z.object({
  _id: z.string(),
  engagementId: z.string(),
  clientId: z.string(),
  title: z.string(),
  version: z.number(),
  status: z.enum(['draft', 'review', 'final']),
  sections: z.object({
    executiveSummary: z.string(),
    architectureOverview: z.string().optional(),
    problems: z.array(
      z.object({
        title: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        description: z.string(),
        impact: z.string().optional(),
      }),
    ),
    recommendations: z.array(
      z.object({
        title: z.string(),
        priority: z.enum(['low', 'medium', 'high']),
        description: z.string(),
        effort: z.string().optional(),
      }),
    ),
    actionPlan: z.array(
      z.object({
        step: z.number(),
        title: z.string(),
        description: z.string(),
        responsible: z.string().optional(),
        deadline: z.date().optional(),
      }),
    ),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### Report Templates Collection

```typescript
const ReportTemplateSchema = z.object({
  _id: z.string(),
  name: z.string(),
  template: z.string(), // Markdown/Handlebars template content
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

---

## API Endpoints

| Method | Path                           | Description                              |
| ------ | ------------------------------ | ---------------------------------------- |
| POST   | /reports                       | Create report                            |
| GET    | /reports                       | List reports (paginated, filterable)     |
| GET    | /reports/:id                   | Get report                               |
| PUT    | /reports/:id                   | Update report data (creates new version) |
| GET    | /reports/:id/versions          | List all versions                        |
| GET    | /reports/:id/versions/:version | Get specific version                     |
| POST   | /reports/:id/generate/markdown | Generate markdown document               |
| POST   | /reports/:id/generate/pdf      | Generate PDF document                    |

---

## Report Generation Pipeline

```
Structured JSON Data → Markdown Template Engine → Markdown Document → HTML Renderer → PDF Generator → Final PDF
```

1. **JSON → Markdown:** Report data is injected into Handlebars/Mustache templates. Templates define section layout and formatting.
2. **Markdown → HTML:** Rendered to styled HTML with CSS (professional layout, company branding, logos).
3. **HTML → PDF:** Converted via Puppeteer with headers, footers, pagination, and company logo.

### PDF Requirements

- Professional layout with consistent typography
- Company logo in header
- Structured sections with headers
- Page numbers in footer
- Table of contents for reports with 5+ sections

---

## Business Rules

1. A report must be linked to an existing engagement and client (validated via respective services).
2. Updating a report increments the version number and stores the previous version.
3. Only `draft` reports can be edited. `review` and `final` reports are read-only.
4. To edit a `final` report, a new version must be created (reverts to `draft` status).
5. PDF generation must complete within 10 seconds.
6. Reports inherit the client and engagement context for template rendering.

---

## Acceptance Criteria

- [ ] CRUD operations work for reports
- [ ] Updating a report creates a new version
- [ ] Previous versions are retrievable
- [ ] Markdown generation produces valid markdown output
- [ ] PDF generation produces a styled PDF with company branding
- [ ] PDF includes headers, footers, and pagination
- [ ] Only draft reports can be modified
- [ ] Creating a report with invalid engagementId/clientId returns 404

---

## How to Verify

Start the service:

```bash
pnpm --filter @shire/report-service dev
```

First, get a JWT token from the auth service (or craft one for local dev):

```bash
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({userId:'u1',email:'dev@test.com',role:'consultant'},'dev-secret-change-me'))")
```

Ensure a client exists (via client-service on port 3002) and an engagement exists (via engagement-service on port 3003). Note their `_id` values as `<clientId>` and `<engagementId>`.

1. **Create a report:**

   ```bash
   curl -s -X POST http://localhost:3004/reports \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"engagementId":"<engagementId>","clientId":"<clientId>","title":"Security Audit Report","sections":{"executiveSummary":"Overview of findings.","problems":[{"title":"SQL Injection","severity":"critical","description":"Found SQL injection in login form","impact":"Full database compromise"}],"recommendations":[{"title":"Use parameterized queries","priority":"high","description":"Replace string concatenation with parameterized queries"}],"actionPlan":[{"step":1,"title":"Fix login form","description":"Parameterize the login query","responsible":"Dev Team"}]}}'
   ```

   Expected: `201` with the created report, `version` set to `1`, `status` set to `draft`. Save the `_id`.

2. **Create with non-existent engagement (404):**

   ```bash
   curl -s -X POST http://localhost:3004/reports \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"engagementId":"non-existent","clientId":"<clientId>","title":"Test","sections":{"executiveSummary":"Test"}}'
   ```

   Expected: `404` with `ENGAGEMENT_NOT_FOUND`.

3. **Create with non-existent client (404):**

   ```bash
   curl -s -X POST http://localhost:3004/reports \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"engagementId":"<engagementId>","clientId":"non-existent","title":"Test","sections":{"executiveSummary":"Test"}}'
   ```

   Expected: `404` with `CLIENT_NOT_FOUND`.

4. **List reports with filters:**

   ```bash
   curl -s "http://localhost:3004/reports?status=draft&engagementId=<engagementId>&page=1&limit=10" \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with paginated response (`data`, `total`, `page`, `limit`).

5. **Get report by ID** (replace `<id>`):

   ```bash
   curl -s http://localhost:3004/reports/<id> \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with report details.

6. **Update a report (creates new version):**

   ```bash
   curl -s -X PUT http://localhost:3004/reports/<id> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title":"Updated Report Title","sections":{"executiveSummary":"Updated summary."}}'
   ```

   Expected: `200` with updated report. `version` incremented to `2`. Unmodified sections preserved.

7. **Update a non-draft report (422):**

   ```bash
   # First, set status to review
   curl -s -X PUT http://localhost:3004/reports/<id> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status":"review"}'

   # Then try to update again
   curl -s -X PUT http://localhost:3004/reports/<id> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title":"Should fail"}'
   ```

   Expected: `422` with `IMMUTABLE_STATUS`.

8. **List all versions:**

   ```bash
   curl -s http://localhost:3004/reports/<id>/versions \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with array of all versions, sorted by version number.

9. **Get specific version:**

   ```bash
   curl -s http://localhost:3004/reports/<id>/versions/1 \
     -H "Authorization: Bearer $TOKEN"
   ```

   Expected: `200` with the original version 1 data.

10. **Generate markdown:**

    ```bash
    curl -s -X POST http://localhost:3004/reports/<id>/generate/markdown \
      -H "Authorization: Bearer $TOKEN"
    ```

    Expected: `200` with `{"markdown":"..."}` containing valid markdown with report title, sections, problems, recommendations, and action plan table.

11. **Request without auth (401):**

    ```bash
    curl -s http://localhost:3004/reports
    ```

    Expected: `401`.

12. **Health check:**

    ```bash
    curl -s http://localhost:3004/health
    ```

    Expected: `{"status":"ok","service":"report-service"}`.

13. **Metrics endpoint:**

    ```bash
    curl -s http://localhost:3004/metrics
    ```

    Expected: Prometheus-format metrics output.

---

## Dependencies

- **Engagement Service** — validates `engagementId`
- **Client Service** — retrieves client info for report headers and templates
- **Consumed by:** Analytics Service (report counts)
