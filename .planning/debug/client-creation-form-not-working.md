---
status: diagnosed
trigger: 'Client creation form at http://localhost:8888/clients/new is not working - the "CREATE CLIENT" action does not trigger new client creation'
created: 2026-03-10T16:40:00.000Z
updated: 2026-03-10T16:50:00.000Z
---

## Current Focus

hypothesis: The form onSubmit handler is incorrectly implemented - it wraps handleSubmit incorrectly which prevents the form from properly submitting
test: Review the ClientForm.tsx code and compare with react-hook-form documentation
expecting: Finding incorrect handler implementation that doesn't actually call the form submission logic
next_action: Return diagnosis with root cause identified

## Symptoms

expected: Clicking "CREATE CLIENT" button should submit the form and create a new client via POST /api/clients
actual: Clicking "CREATE CLIENT" button does not trigger client creation - nothing happens
errors: None visible (need to check browser console)
reproduction: Navigate to http://localhost:8888/clients/new, fill out form, click "CREATE CLIENT"
started: Unknown (issue reported during Phase 01-cross-service-validation)

## Evidence

- timestamp: 2026-03-10T16:40:00.000Z
  checked: /home/gal/w/code/git/shire/apps/web-app/src/features/clients/components/ClientForm.tsx
  found: Line 34: `<form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>` - This is WRONG
  implication: This creates a handler that receives event `e`, calls `void` on the result of `handleSubmit(onSubmit)(e)`, but this doesn't work because `handleSubmit` expects to be called without arguments in the onSubmit assignment

- timestamp: 2026-03-10T16:42:00.000Z
  checked: react-hook-form documentation and behavior
  found: `handleSubmit` returns a function that accepts the form event. The correct pattern is `onSubmit={handleSubmit(onSubmit)}` not `onSubmit={(e) => void handleSubmit(onSubmit)(e)}`
  implication: The current implementation calls handleSubmit with the event, but since `handleSubmit` was already called to get the handler, the event is being passed to a function that may not handle it correctly

- timestamp: 2026-03-10T16:43:00.000Z
  checked: TanStack Query mutation setup in clientMutations.ts
  found: `useCreateClient` and `useUpdateClient` are properly configured using `customFetcher` to call `/api/clients`
  implication: The mutation logic is correct, the problem is purely in how the form triggers the mutation

- timestamp: 2026-03-10T16:44:00.000Z
  checked: API routing in bff-service/routes/clients.ts
  found: POST /api/clients is properly proxied to client-service via `proxyRequest`
  implication: Backend routing is correct, issue is in frontend form handling

- timestamp: 2026-03-10T16:49:00.000Z
  checked: All form components in the web-app
  found: THREE forms have the same bug:
  1. apps/web-app/src/features/clients/components/ClientForm.tsx line 34
  2. apps/web-app/src/features/engagements/components/EngagementForm.tsx line 48
  3. apps/web-app/src/features/auth/components/LoginForm.tsx line 32
     implication: This is a systemic issue affecting ALL form submissions in the web-app

## Eliminated

- hypothesis: Backend API endpoint is broken
  evidence: POST /api/clients route exists and properly proxies to client-service; integration tests pass
  timestamp: 2026-03-10T16:44:00.000Z

- hypothesis: TanStack Query mutation is misconfigured
  evidence: clientMutations.ts correctly uses customFetcher with proper URL and method
  timestamp: 2026-03-10T16:43:00.000Z

- hypothesis: nginx proxy configuration is wrong
  evidence: nginx.conf correctly proxies /api/ to bff-service:3007
  timestamp: 2026-03-10T16:44:00.000Z

## Resolution

root_cause: The form's onSubmit handler is incorrectly implemented across ALL forms in the web-app. `handleSubmit(onSubmit)` returns a function that should be assigned directly to onSubmit, but instead it's wrapped in an arrow function `(e) => void handleSubmit(onSubmit)(e)` which breaks the submission flow.

The correct pattern for react-hook-form is:

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
```

The current incorrect pattern used in all forms:

```tsx
<form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
```

This causes form submission to not actually trigger the mutation because react-hook-form's handleSubmit is being called in a way that doesn't properly intercept and handle the form submission event.

**Affected files:**

1. /home/gal/w/code/git/shire/apps/web-app/src/features/clients/components/ClientForm.tsx (line 34)
2. /home/gal/w/code/git/shire/apps/web-app/src/features/engagements/components/EngagementForm.tsx (line 48)
3. /home/gal/w/code/git/shire/apps/web-app/src/features/auth/components/LoginForm.tsx (line 32)

fix: Change all three files from:

```tsx
<form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
```

to:

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
```

verification: After fix, clicking form submit buttons should properly call the mutations which will POST to their respective API endpoints

files_changed:

- apps/web-app/src/features/clients/components/ClientForm.tsx
- apps/web-app/src/features/engagements/components/EngagementForm.tsx
- apps/web-app/src/features/auth/components/LoginForm.tsx
