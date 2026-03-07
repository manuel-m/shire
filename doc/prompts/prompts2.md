You are a senior backend architect specialized in Node.js, TypeScript, and microservice architectures.

I currently have a Node.js backend composed of multiple microservices written in **TypeScript**, using **Express** and **Zod**.

Current services:

* auth-service
* customer-service

Both services contain duplicated code such as:

* authentication middleware
* health check endpoints
* Zod validation middleware
* shared utilities
* error handling
* common types

I want to refactor the project into a **PNPM Workspace monorepo architecture** in order to:

* remove duplicated code
* share common modules
* keep services independently deployable
* improve maintainability and scalability

Requirements:

1. Convert the repository into a **PNPM workspace monorepo**.

2. Introduce a **shared internal package** containing reusable logic:

packages/shared

This shared package should contain:

* reusable Express middlewares
* authentication middleware
* health check route handler
* Zod validation middleware
* shared Zod schemas
* error handling utilities
* shared TypeScript types

3. The project structure should look like:

```
/services
  /auth-service
  /customer-service

/packages
  /shared
```

4. Each service should import shared code like:

```
import { authMiddleware } from "@shire/shared/middleware";
```

5. Implement a reusable health endpoint:

```
GET /health
```

Returning:

```
{
  "status": "ok",
  "service": "auth-service",
  "timestamp": "ISO_DATE"
}
```

6. The authentication middleware should validate JWT tokens and be reusable across services.

7. Configure **pnpm-workspace.yaml** properly.

8. Ensure the shared package builds correctly and can be imported by services.

9. Maintain **Docker compatibility** for each service.

10. Provide:

* the refactored folder structure
* pnpm workspace configuration
* shared package structure
* example shared middleware
* example usage inside a service
* explanation of architectural decisions

Constraints:

* TypeScript-first
* Express-based services
* Zod validation
* avoid circular dependencies
* services must remain deployable independently
* shared package must be reusable by future microservices
