# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- Services: `kebab-case.ts` for route files (e.g., `clients.ts`, `credentials.ts`)
- Tests: `[entity].integration.test.ts` for integration tests
- React components: `PascalCase.tsx` (e.g., `ClientForm.tsx`, `DataTable.tsx`)
- Pages: `[entity][Action]Page.tsx` (e.g., `ClientCreatePage.tsx`, `ClientsListPage.tsx`)
- API modules: `[entity]Mutations.ts`, `[entity]Queries.ts`, `[entity]Keys.ts`

**Functions:**
- `camelCase` for all function names (e.g., `createClient`, `getClientsCollection`)
- Handler names match HTTP method: `useCreateClient`, `useUpdateClient`, `useClientSearch`

**Variables:**
- `camelCase` for all variables
- Constants use `SCREAMING_SNAKE_CASE` for module-level constants (e.g., `CLIENT_NOT_FOUND`, `VALID_STATUS_TRANSITIONS`)

**Types:**
- `PascalCase` for type names (e.g., `Client`, `EngagementFormData`, `AuthPayload`)
- Never define local types that duplicate `@shire/shared-types` schemas
- Import types from `@shire/shared-types` or infer from Zod schemas

## Code Style

**Formatting:**
- Tool: Prettier
- Key settings:
  - Single quotes: `true`
  - Semicolons: `true`
  - Trailing commas: `all`
  - Print width: `100`

**Linting:**
- Tool: ESLint with `typescript-eslint` and `sonarjs`
- Key rules:
  - `sonarjs/cognitive-complexity`: max 15
  - `sonarjs/no-duplicate-string`: threshold 3
  - Unused vars with `_` prefix allowed (e.g., `req.requestId` where `req.requestId` is destructured)

**TypeScript:**
- Strict mode enabled
- ES modules (`"type": "module"`)
- Use `as const` for type assertions where appropriate
- Use `satisfies` for type checking with autocomplete support (e.g., `{ ... } satisfies AuthPayload`)

## Import Organization

**Order:**
1. Node.js built-ins (e.g., `import { randomUUID } from 'node:crypto'`)
2. External packages (e.g., `import express from 'express'`)
3. Workspace packages (e.g., `import { createAuthMiddleware } from '@shire/shared'`)
4. Local/relative imports (e.g., `import { config } from '../config.js'`)

**Path Aliases:**
- `@shire/shared` - Shared utilities and middleware
- `@shire/shared-types` - Zod schemas and inferred types
- `@shire/api-client` - Generated API client and custom fetcher

**ESM Extensions:**
- All imports must include `.js` extension for ESM compatibility
- Example: `import { getClientsCollection } from '../db.js'`

## Error Handling

**Service-side (Express):**
- Always validate request body with Zod schemas using `safeParse()`
- Return 400 with standardized error shape: `{ error: { code: string, message: string } }`
- Common error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `EMAIL_EXISTS`, `DUPLICATE_NAME`
- Use early returns after validation failures

```typescript
const parsed = CreateClientSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
  return;
}
```

**Client-side (React):**
- Mutations use `useMutation` from TanStack Query
- Errors exposed via `mutation.error.message`
- Display errors with MUI `Alert` components

## Logging

**Framework:** Custom logger from `@shire/shared`

**Patterns:**
- Create logger per service: `const { log } = createLogger(config.serviceName)`
- Log level: `info`, `warn`, `error`, `debug`
- Always include `requestId` from middleware for traceability
- Structured JSON output: `{ timestamp, service, level, message, ...metadata }`

```typescript
log('info', 'Client created', {
  clientId: client._id,
  companyName: client.companyName,
  requestId: req.requestId,
});
```

**Sensitive data:** Never log passwords, tokens, or raw credential values

## Comments

**When to Comment:**
- Business logic that isn't immediately obvious
- Security considerations (e.g., cascade deletes)
- Workaround comments with `// eslint-disable-next-line` and reason
- Inline comments for complex algorithms

**JSDoc/TSDoc:**
- Used sparingly - Zod schemas serve as documentation
- Custom hooks may include JSDoc for clarity

**TODO/FIXME:**
- Used sparingly for known work items
- Include reason/description

## Function Design

**Size:** Functions should be under 50 lines where possible; larger functions indicate need for extraction

**Parameters:**
- Route handlers take `(req: Request, res: Response)` or `(req: Request, res: Response, next: NextFunction)`
- Service functions take typed parameters (e.g., `clientId: string`)
- Use destructuring for clarity in route handlers

**Return Values:**
- Service functions: return typed values or throw errors
- Route handlers: always return void, use `res.json()` or `res.status().json()`
- API queries: return typed responses via `customFetcher<T>`

## Module Design

**Exports:**
- Default exports: rare, use named exports instead
- Re-exports via barrel files: `src/index.ts` in each package
- Schema exports: both Zod schema and inferred type

**Barrel Files:**
- Services: `src/index.ts` exports `createApp()`, route routers, and config
- Packages: `src/index.ts` re-exports all public APIs
- Shared types: `src/index.ts` exports all schemas

**Feature Modules (React):**
```
src/features/[domain]/
  api/
    [domain]Mutations.ts    # useCreate*, useUpdate*
    [domain]Queries.ts      # use*, useSearch
    [domain]Keys.ts         # TanStack Query keys
  components/              # Presentational components
  pages/                  # Route components (own data fetching)
```

## Security Conventions

**Authentication:**
- Use `requireAuth` middleware from `@shire/shared` for protected routes
- Access tokens stored in memory (React app), refresh tokens in localStorage
- JWT with Bearer scheme: `Authorization: Bearer <token>`

**Data Protection:**
- Credentials encrypted at rest using AES-256-GCM (see `crypto.ts`)
- Audit log all credential access (read/write)
- Exclude sensitive fields from projections: `{ projection: { codeCredentials: 0 } }`

**Validation:**
- All input validated via Zod schemas from `@shire/shared-types`
- Never trust client input

## React Specific Conventions

**Components:**
- Functional components only
- Props interface defined before component
- Use `Readonly<Props>` for prop types
- Custom hooks in `hooks/` directory

**Forms:**
- `react-hook-form` with `zodResolver`
- Schema from `@shire/shared-types` is single source of truth
- Use `Controller` for MUI components (e.g., `Autocomplete`)

**State:**
- Server state: TanStack Query (`useQuery`, `useMutation`)
- Local UI state: `useState` sparingly
- Forms: `react-hook-form` state

**Event Handlers:**
- Void return type for event handlers
- Use `(e) => void handleSubmit(onSubmit)(e)` to handle form submissions

---

*Convention analysis: 2026-03-10*
