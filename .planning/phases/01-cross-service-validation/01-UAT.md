---
status: testing
phase: 01-cross-service-validation
source: [01-cross-service-validation-01-SUMMARY.md, 01-cross-service-validation-02-SUMMARY.md]
started: 2026-03-10T00:00:00Z
updated: 2026-03-10T17:30:00Z
---

## Current Test

number: 1
name: Delete Client with No Engagements
expected: |
Create a client. Attempt to delete it without creating any engagements.
Expected: HTTP 204 No Content. Deletion succeeds immediately.
awaiting: user response

## Tests

### 1. Delete Client with No Engagements

expected: Create a client. Attempt to delete it without creating any engagements. Expected: HTTP 204 No Content. Deletion succeeds immediately.
result: [pending]

### 2. Delete Client with Active Engagements

expected: Create a client, then create one or more engagements linked to that client. Attempt to delete the client. Expected: HTTP 422 Unprocessable Entity with error code "ACTIVE_ENGAGEMENTS". Deletion is blocked with a clear message.
result: [pending]

### 3. Client Deletion with Unavailable Engagement-Service

expected: Stop the engagement-service. Create a client and attempt to delete it. Expected: HTTP 204 No Content. Deletion succeeds (fail-open strategy) - operation is not blocked when validation service is unavailable.
result: [pending]

### 4. Delete Engagement with No Reports or Invoices

expected: Create an engagement with no associated reports or invoices. Attempt to delete it. Expected: HTTP 204 No Content. Deletion succeeds immediately.
result: [pending]

### 5. Delete Engagement with Associated Reports

expected: Create an engagement, then create one or more reports linked to that engagement. Attempt to delete the engagement. Expected: HTTP 422 Unprocessable Entity with error code "HAS_ASSOCIATED_RECORDS". Deletion is blocked.
result: [pending]

### 6. Delete Engagement with Associated Invoices

expected: Create an engagement, then create one or more invoices linked to that engagement. Attempt to delete the engagement. Expected: HTTP 422 Unprocessable Entity with error code "HAS_ASSOCIATED_RECORDS". Deletion is blocked.
result: [pending]

### 7. Engagement Deletion with Unavailable Services

expected: Stop both report-service and billing-service. Create an engagement and attempt to delete it. Expected: HTTP 204 No Content. Deletion succeeds (fail-open strategy) when validation services are unavailable.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

none

## Notes

Gap fix executed at 2026-03-10T17:26:00Z - form submission handlers fixed in ClientForm, EngagementForm, and LoginForm. Resuming UAT from test 1.
