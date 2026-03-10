---
phase: 2
slug: bff-error-handling
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                               |
| ---------------------- | --------------------------------------------------- |
| **Framework**          | vitest 3.1.0                                        |
| **Config file**        | services/bff-service/vitest.config.ts (per-service) |
| **Quick run command**  | `pnpm --filter @shire/bff-service test`             |
| **Full suite command** | `pnpm -r test`                                      |
| **Estimated runtime**  | ~15 seconds                                         |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @shire/bff-service test`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement                                    | Test Type   | Automated Command                                                                                                                                                                                                       | File Exists | Status     |
| --------- | ---- | ---- | ---------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 02-00-01  | 00   | 0    | ERR-03, ERR-04, ERR-06                         | integration | `test -f services/bff-service/src/routes/dashboard.integration.test.ts`                                                                                                                                                 | W0          | ⬜ pending |
| 02-01a-01 | 01a  | 0    | ERR-03, ERR-04, ERR-05, ERR-06                 | integration | `test -f services/bff-service/src/routes/clients.integration.test.ts`                                                                                                                                                   | W0          | ⬜ pending |
| 02-02a-01 | 02a  | 0    | ERR-03, ERR-06                                 | integration | `test -f services/bff-service/src/routes/engagements.integration.test.ts`                                                                                                                                               | W0          | ⬜ pending |
| 02-03a-01 | 03a  | 0    | ERR-03, ERR-04, ERR-05, ERR-06                 | integration | `test -f services/bff-service/src/routes/reports.integration.test.ts`                                                                                                                                                   | W0          | ⬜ pending |
| 02-04a-01 | 04a  | 0    | ERR-03, ERR-04, ERR-05, ERR-06                 | integration | `test -f services/bff-service/src/routes/invoices.integration.test.ts`                                                                                                                                                  | W0          | ⬜ pending |
| 02-01-01  | 01   | 1    | ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06 | unit        | `grep -q "router.get.*async" services/bff-service/src/routes/dashboard.ts && grep -q "try {" services/bff-service/src/routes/dashboard.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/dashboard.ts` | W0          | ⬜ pending |
| 02-02-01  | 02   | 1    | ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06 | unit        | `grep -q "router.get.*async" services/bff-service/src/routes/clients.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/clients.ts`                                                                     | W0          | ⬜ pending |
| 02-03-01  | 03   | 2    | ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06 | unit        | `grep -q "router.get.*async" services/bff-service/src/routes/engagements.ts && grep -q "try {" services/bff-service/src/routes/engagements.ts`                                                                          | W0          | ⬜ pending |
| 02-04-01  | 04   | 2    | ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06 | unit        | `grep -q "router.get.*async" services/bff-service/src/routes/reports.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/reports.ts`                                                                     | W0          | ⬜ pending |
| 02-05-01  | 05   | 2    | ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06 | unit        | `grep -q "router.get.*async" services/bff-service/src/routes/invoices.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/invoices.ts`                                                                   | W0          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `services/bff-service/src/routes/dashboard.integration.test.ts` — Plan 00 (Wave 0)
- [x] `services/bff-service/src/routes/clients.integration.test.ts` — Plan 01a (Wave 0)
- [x] `services/bff-service/src/routes/engagements.integration.test.ts` — Plan 02a (Wave 0)
- [x] `services/bff-service/src/routes/reports.integration.test.ts` — Plan 03a (Wave 0)
- [x] `services/bff-service/src/routes/invoices.integration.test.ts` — Plan 04a (Wave 0)
- [x] Framework install: None - vitest already in package.json

---

## Manual-Only Verifications

| Behavior                            | Requirement    | Why Manual                   | Test Instructions                                                                         |
| ----------------------------------- | -------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| Error logs contain request ID       | ERR-03, ERR-06 | Requires log inspection      | Trigger service failure, check console output for requestId field                         |
| Error messages include service name | ERR-04         | Requires response inspection | Trigger service failure, verify response contains "Client service unavailable" or similar |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (created in Plans 00, 01a, 02a, 03a, 04a)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
