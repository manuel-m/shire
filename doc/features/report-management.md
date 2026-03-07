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
    problems: z.array(z.object({
      title: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      description: z.string(),
      impact: z.string().optional(),
    })),
    recommendations: z.array(z.object({
      title: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      description: z.string(),
      effort: z.string().optional(),
    })),
    actionPlan: z.array(z.object({
      step: z.number(),
      title: z.string(),
      description: z.string(),
      responsible: z.string().optional(),
      deadline: z.date().optional(),
    })),
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
  template: z.string(),  // Markdown/Handlebars template content
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /reports | Create report |
| GET | /reports | List reports (paginated, filterable) |
| GET | /reports/:id | Get report |
| PUT | /reports/:id | Update report data (creates new version) |
| GET | /reports/:id/versions | List all versions |
| GET | /reports/:id/versions/:version | Get specific version |
| POST | /reports/:id/generate/markdown | Generate markdown document |
| POST | /reports/:id/generate/pdf | Generate PDF document |

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

## Dependencies

- **Engagement Service** — validates `engagementId`
- **Client Service** — retrieves client info for report headers and templates
- **Consumed by:** Analytics Service (report counts)
