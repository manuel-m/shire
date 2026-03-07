# Feature: Billing and Invoices

## Overview

The Billing Service manages invoice creation, payment tracking, and payment reminders. Each invoice is linked to a client and an engagement. The service tracks the full invoice lifecycle from draft through payment.

**Source:** PRD Section 5.5, prompts0.md (Billing).

---

## User Stories

1. **As a consultant**, I want to create an invoice for an engagement so that I can bill the client.
2. **As a consultant**, I want to add line items to an invoice with descriptions, quantities, and unit prices.
3. **As a consultant**, I want to track invoice status (draft, issued, pending, paid, overdue).
4. **As a consultant**, I want to send an invoice to the client.
5. **As a consultant**, I want to mark an invoice as paid when payment is received.
6. **As a consultant**, I want to send payment reminders for overdue invoices.
7. **As a consultant**, I want to view all invoices for a client or engagement.

---

## Data Model

### Invoices Collection

```typescript
const InvoiceSchema = z.object({
  _id: z.string(),
  clientId: z.string(),
  engagementId: z.string(),
  invoiceNumber: z.string(),
  amount: z.number(),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  status: z.enum(['draft', 'issued', 'pending-payment', 'paid', 'overdue']),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })),
  issueDate: z.date(),
  dueDate: z.date(),
  paidDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /invoices | Create invoice |
| GET | /invoices | List invoices (paginated, filterable) |
| GET | /invoices/:id | Get invoice |
| PUT | /invoices/:id | Update invoice |
| PATCH | /invoices/:id/status | Update invoice status |
| POST | /invoices/:id/send | Send invoice to client |
| POST | /invoices/:id/remind | Send payment reminder |
| GET | /invoices/client/:clientId | Get invoices by client |
| GET | /invoices/engagement/:engagementId | Get invoices by engagement |

---

## Business Rules

1. `clientId` and `engagementId` must reference existing entities (validated via respective services).
2. `invoiceNumber` is auto-generated and unique (format: `INV-YYYYMM-NNN`).
3. `amount` is computed as the sum of all `lineItems[].total`.
4. Status transitions: `draft` → `issued` → `pending-payment` → `paid` or `overdue`.
5. Only `draft` invoices can be edited. `issued` and beyond are immutable (except status).
6. `paidDate` is set automatically when status changes to `paid`.
7. An invoice becomes `overdue` when `dueDate` passes and status is `pending-payment` (checked by a scheduled job or on access).
8. Payment reminders can only be sent for `pending-payment` or `overdue` invoices.

---

## Acceptance Criteria

- [ ] CRUD operations work for invoices
- [ ] Invoice number is auto-generated with correct format
- [ ] Amount is computed from line items
- [ ] Only draft invoices can be edited
- [ ] Status transitions are validated (invalid transitions return 422)
- [ ] paidDate is set when marking as paid
- [ ] Invoices can be filtered by client, engagement, and status
- [ ] Payment reminders work for pending/overdue invoices only
- [ ] Creating an invoice with invalid clientId/engagementId returns 404

---

## Dependencies

- **Client Service** — validates `clientId`, retrieves client details for invoice rendering
- **Engagement Service** — validates `engagementId`
- **Consumed by:** Analytics Service (revenue calculations)
