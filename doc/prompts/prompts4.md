You are a senior full-stack engineer. The task is to generate a production-ready frontend for a TypeScript monorepo, using a **Backend-for-Frontend (BFF)** pattern with automated API client generation via Orval.

The repository structure:

packages/
shared
shared-types

services/
auth-service
client-service
engagement-service
report-service
billing-service

apps/
web-app

Each backend microservice exposes OpenAPI specifications internally.

---

# Requirements

1. **Frontend tech stack**

- React + Vite
- TypeScript
- Material UI
- React Router
- React Hook Form + Zod validation
- TanStack Query for server state

2. **BFF pattern**

- Introduce a BFF service (services/bff-service)
- The frontend only communicates with the BFF
- The BFF aggregates, transforms, or enriches data from internal microservices
- **Only the BFF exposes a port to the frontend**; the other microservices do NOT expose ports externally
- The BFF exposes its own OpenAPI specification for frontend consumption

3. **API client generation**

- Use Orval to generate a fully typed API client from the BFF OpenAPI
- Generate:
  - TypeScript types
  - API functions
  - TanStack Query hooks

- The API client must live in packages/api-client
- Include a custom fetcher that automatically attaches JWT tokens

4. **Frontend architecture**

- Feature-based structure:

apps/web-app/src
app/
router.tsx
features/
auth
clients
contacts
engagements
reports
billing
components/
layout
tables
forms
navigation
lib/
api (generated Orval client)
auth
query
providers/
hooks/

- Each feature contains:
  - api hooks
  - components
  - pages

5. **Authentication**

- JWT-based
- Login page
- Protected routes
- AuthProvider + useAuth hook

6. **Pages to generate**

- Login
- Dashboard
- Clients (list, create, edit, details)
- Contacts
- Engagements (list, create, update)
- Reports (list, view, generate PDF)
- Billing (list invoices, view invoice)

7. **UI and UX**

- Material UI components
- AppBar + Drawer sidebar
- DataGrid for tables
- Dialogs for forms
- Forms with validation

8. **Data fetching**

- Use generated Orval hooks
- Queries and mutations with proper cache keys
- Automatic query invalidation after mutations

9. **Observability**

- Basic frontend logging
- Optionally send errors to a backend endpoint

---

# Deliverables

1. Full frontend folder structure under apps/web-app
2. BFF service folder with example aggregation routes
3. Orval configuration in packages/api-client
4. Example usage of generated hooks in React components
5. Example form using React Hook Form + Zod
6. Example table using Material UI DataGrid
7. Authentication flow integrated
8. Type-safe, maintainable, production-ready code

---

Generate the **frontend + BFF + Orval client** in a way that:

- the frontend **only communicates with the BFF**,
- the internal microservices do NOT expose ports externally,
- the Orval-generated client is fully typed with hooks ready for TanStack Query,
- the shared-types package from the monorepo is used for consistent typing,
- and the frontend code is ready for production with Material UI components, proper routing, forms, tables, and authentication.
