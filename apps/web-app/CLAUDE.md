# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server on port 5173 (proxies /api → localhost:3007)
pnpm build        # Type-check + Vite bundle
pnpm type-check   # TypeScript check only (no emit)
pnpm lint         # ESLint over src/
pnpm preview      # Preview production build
```

No tests are configured at the app level — tests live in the monorepo services.

## Architecture

**React 19 SPA** built with Vite, TypeScript strict mode, MUI v6, React Router v7, React Hook Form + Zod, and TanStack Query v5.

### Provider stack (outermost → innermost)

`BrowserRouter` → `ThemeProvider` → `QueryClientProvider` → `AuthProvider`

### Authentication

- Access token stored **in memory** (lost on reload), refresh token in `localStorage`
- `AuthProvider` (`src/lib/auth/AuthProvider.tsx`) restores session on mount via `/api/auth/refresh`
- All API calls must include `authHeaders()` from `src/lib/auth/headers.ts`
- Token accessors are wired into `@shire/api-client` on login

### Routing

All routes except `/login` are protected by `ProtectedRoute`. Routes are defined in `src/app/router.tsx` under `AppLayout` (sidebar + appbar shell). Pattern:

```
/clients                  → list
/clients/new              → create form
/clients/:id              → detail view
/clients/:id/edit         → edit form
```

Same pattern applies to `/engagements`, `/reports`, `/invoices`.

### Feature modules (`src/features/<domain>/`)

Each feature contains `pages/` and `components/`. Pages own data fetching; components are presentational.

### Data fetching — known tech debt

**TanStack Query is configured but not used.** All data fetching currently uses `useState + useEffect + fetch()` directly in page components. `QueryClient` defaults are set in `src/lib/query/query-client.ts` (`staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`). New code should use `useQuery`/`useMutation` hooks; migrations are pending.

### Forms

All forms use `react-hook-form` with `zodResolver` against Zod schemas imported from `@shire/shared-types`. Schema is the single source of truth — never define local types that duplicate shared schemas. Form submission calls `fetch()` directly; these should eventually migrate to `useMutation`.

### Shared packages

- `@shire/shared-types` — Zod schemas + inferred TS types (import these, never redefine)
- `@shire/api-client` — generated API client (used for typed responses; raw `fetch()` is also common)

### Reusable components

- `DataTable` (`src/components/tables/DataTable.tsx`) — generic server-side paginated MUI DataGrid wrapper; use this for all tables
- `FormDialog` — generic dialog wrapper for forms
- `EngagementStatusChip` — canonical status badge with color coding
