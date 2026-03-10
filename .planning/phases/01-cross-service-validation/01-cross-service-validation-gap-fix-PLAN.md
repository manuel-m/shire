---
phase: 01-cross-service-validation
plan: gap-fix
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web-app/src/features/clients/components/ClientForm.tsx
  - apps/web-app/src/features/engagements/components/EngagementForm.tsx
  - apps/web-app/src/features/auth/components/LoginForm.tsx
autonomous: true
gap_closure: true
requirements: []
user_setup: []

must_haves:
  truths:
    - 'Client creation form at /clients/new successfully creates a new client'
    - 'Engagement creation form successfully creates a new engagement'
    - 'Login form successfully authenticates the user'
  artifacts:
    - path: 'apps/web-app/src/features/clients/components/ClientForm.tsx'
      provides: 'Fixed onSubmit handler for client form'
      contains: 'onSubmit={handleSubmit(onSubmit)}'
    - path: 'apps/web-app/src/features/engagements/components/EngagementForm.tsx'
      provides: 'Fixed onSubmit handler for engagement form'
      contains: 'onSubmit={handleSubmit(onSubmit)}'
    - path: 'apps/web-app/src/features/auth/components/LoginForm.tsx'
      provides: 'Fixed onSubmit handler for login form'
      contains: 'onSubmit={handleSubmit(onSubmit)}'
  key_links:
    - from: 'ClientForm.tsx'
      to: 'clientMutations.useCreateClient'
      via: 'onSubmit callback'
      pattern: "mutation\\.mutate\\(data"
    - from: 'EngagementForm.tsx'
      to: 'engagementMutations.useCreateEngagement'
      via: 'onSubmit callback'
      pattern: "mutation\\.mutate\\(data"
    - from: 'LoginForm.tsx'
      to: 'authContext.login'
      via: 'onSubmit callback'
      pattern: "await login\\(data\\.email"
---

<objective>
Fix form submission bug across all three form components in web-app by correcting react-hook-form onSubmit handler implementation.

Purpose: Form submissions are broken because handleSubmit is incorrectly wrapped in an arrow function, preventing the form from properly triggering mutations and API calls.

Output: Working forms that successfully submit data to their respective API endpoints.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/01-cross-service-validation/01-UAT.md
@.planning/debug/client-creation-form-not-working.md
@.planning/phases/01-cross-service-validation/01-cross-service-validation-01-SUMMARY.md
@.planning/phases/01-cross-service-validation/01-cross-service-validation-02-SUMMARY.md

## Root Cause Analysis

From `.planning/debug/client-creation-form-not-working.md`:

The form's onSubmit handler is incorrectly implemented across ALL forms in the web-app. `handleSubmit(onSubmit)` returns a function that should be assigned directly to onSubmit, but instead it's wrapped in an arrow function `(e) => void handleSubmit(onSubmit)(e)` which breaks the submission flow.

**Current incorrect pattern in all three files:**

```tsx
<form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
```

**Correct react-hook-form pattern:**

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
```

This causes form submission to not actually trigger the mutation because react-hook-form's handleSubmit is being called in a way that doesn't properly intercept and handle the form submission event.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix ClientForm onSubmit handler</name>
  <files>apps/web-app/src/features/clients/components/ClientForm.tsx</files>
  <action>
    Change line 34 from:
    ```tsx
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
    ```
    To:
    ```tsx
    <form onSubmit={handleSubmit(onSubmit)}>
    ```

    This removes the incorrect arrow function wrapper and allows react-hook-form to properly handle form submission events.

    DO NOT modify any other part of the file - only the onSubmit prop on the <form> element.

  </action>
  <verify>grep -n 'onSubmit=' apps/web-app/src/features/clients/components/ClientForm.tsx</verify>
  <done>ClientForm line 34 shows `onSubmit={handleSubmit(onSubmit)}`</done>
</task>

<task type="auto">
  <name>Task 2: Fix EngagementForm onSubmit handler</name>
  <files>apps/web-app/src/features/engagements/components/EngagementForm.tsx</files>
  <action>
    Change line 48 from:
    ```tsx
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
    ```
    To:
    ```tsx
    <form onSubmit={handleSubmit(onSubmit)}>
    ```

    This removes the incorrect arrow function wrapper and allows react-hook-form to properly handle form submission events.

    DO NOT modify any other part of the file - only the onSubmit prop on the <form> element.

  </action>
  <verify>grep -n 'onSubmit=' apps/web-app/src/features/engagements/components/EngagementForm.tsx</verify>
  <done>EngagementForm line 48 shows `onSubmit={handleSubmit(onSubmit)}`</done>
</task>

<task type="auto">
  <name>Task 3: Fix LoginForm onSubmit handler</name>
  <files>apps/web-app/src/features/auth/components/LoginForm.tsx</files>
  <action>
    Change line 32 from:
    ```tsx
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
    ```
    To:
    ```tsx
    <form onSubmit={handleSubmit(onSubmit)}>
    ```

    This removes the incorrect arrow function wrapper and allows react-hook-form to properly handle form submission events.

    DO NOT modify any other part of the file - only the onSubmit prop on the <form> element.

  </action>
  <verify>grep -n 'onSubmit=' apps/web-app/src/features/auth/components/LoginForm.tsx</verify>
  <done>LoginForm line 32 shows `onSubmit={handleSubmit(onSubmit)}`</done>
</task>

<task type="auto">
  <name>Task 4: Rebuild web-app</name>
  <files>apps/web-app/dist</files>
  <action>
    Rebuild the web-app to apply the changes to the production build.

    Run:
    ```bash
    pnpm --filter @shire/web-app build
    ```

    This will type-check and bundle the application with the fixed form handlers.

  </action>
  <verify>ls -la apps/web-app/dist/index.html && grep -q "handleSubmit(onSubmit)" apps/web-app/dist/assets/*.js 2>/dev/null || echo "Build artifacts not searchable with grep - check completed status"</verify>
  <done>Build completes successfully with exit code 0 and dist/index.html exists</done>
</task>

</tasks>

<verification>
After all tasks complete, verify:
1. All three form files show `onSubmit={handleSubmit(onSubmit)}` (not wrapped in arrow function)
2. web-app builds successfully without errors
3. Type-check passes (included in build step)

Manual verification (to be done in UAT):

- Visit http://localhost:8888/clients/new, fill form, click "Create Client" → client should be created
- Visit http://localhost:8888/engagements/new, fill form, click "Create Engagement" → engagement should be created
- Visit http://localhost:8888/login, enter credentials, click "Sign in" → user should be authenticated
  </verification>

<success_criteria>
Form submission works correctly across all three forms:

- ClientForm successfully calls useCreateClient/useUpdateClient mutation
- EngagementForm successfully calls useCreateEngagement/useUpdateEngagement mutation
- LoginForm successfully calls authContext.login
- web-app builds without TypeScript errors
  </success_criteria>

<output>
After completion, create `.planning/phases/01-cross-service-validation/01-cross-service-validation-gap-fix-SUMMARY.md`
</output>
