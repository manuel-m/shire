# Feature: Authentication

## Overview

The Auth Service handles user authentication, JWT token management, and user profile management. It is a standalone service consumed by the API Gateway for request authentication and directly by clients for login/registration flows.

**Source:** prompts0.md (auth-service), PRD Section 6 (Security), PRD Section 7 (System Architecture).

---

## User Stories

1. **As a consultant**, I want to register an account so that I can access the platform.
2. **As a consultant**, I want to log in with email and password so that I receive a JWT token for API access.
3. **As a consultant**, I want my session to persist via refresh tokens so that I don't have to log in constantly.
4. **As a consultant**, I want to log out so that my refresh token is invalidated.
5. **As a consultant**, I want to view and update my profile information.
6. **As the API Gateway**, I need to validate JWT tokens on every request to enforce authentication.

---

## Data Model

### Users Collection

```typescript
const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'consultant']),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### Refresh Tokens Collection

```typescript
const RefreshTokenSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
});
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register a new user |
| POST | /auth/login | Authenticate and receive JWT + refresh token |
| POST | /auth/refresh | Exchange refresh token for new access token |
| POST | /auth/logout | Invalidate refresh token |
| GET | /auth/me | Get current user profile |
| PUT | /auth/me | Update current user profile |

---

## Business Rules

1. Passwords must be hashed using bcrypt (minimum 12 rounds).
2. Access tokens expire after 15 minutes.
3. Refresh tokens expire after 7 days.
4. A user can have at most 5 active refresh tokens (oldest revoked on overflow).
5. All endpoints except `/auth/register` and `/auth/login` require a valid JWT.
6. Email addresses must be unique.
7. Role-based access control is deferred to a future version; MVP supports `admin` and `consultant` roles with identical permissions.

---

## Acceptance Criteria

- [ ] User can register with email, name, and password
- [ ] User can log in and receives JWT + refresh token
- [ ] Access token can be refreshed using a valid refresh token
- [ ] Logout invalidates the refresh token
- [ ] Invalid or expired tokens return 401
- [ ] Duplicate email registration returns 409
- [ ] API Gateway validates tokens via Auth Service on every request

---

## How to Verify

### Prerequisites

1. Start MongoDB (or the service will use `MONGODB_URI` from env):
   ```bash
   docker run -d -p 27017:27017 --name shire-mongo mongo:7
   ```
2. Install dependencies and build shared types:
   ```bash
   pnpm install
   pnpm --filter @shire/shared-types build
   ```

### Run automated tests

```bash
pnpm --filter @shire/auth-service test
```

This runs integration tests against an in-memory MongoDB (no external DB needed). All acceptance criteria are covered by the test suite.

### Manual verification with curl

1. Start the auth service:
   ```bash
   pnpm --filter @shire/auth-service dev
   ```

2. **Register** a new user:
   ```bash
   curl -s -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
   ```
   Expected: `201` with `user`, `accessToken`, `refreshToken`.

3. **Register duplicate** (same email):
   ```bash
   curl -s -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
   ```
   Expected: `409` with `EMAIL_EXISTS`.

4. **Login**:
   ```bash
   curl -s -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```
   Expected: `200` with `user`, `accessToken`, `refreshToken`. Save the tokens.

5. **Get profile** (replace `<accessToken>`):
   ```bash
   curl -s http://localhost:3001/auth/me \
     -H "Authorization: Bearer <accessToken>"
   ```
   Expected: `200` with user profile (no `passwordHash`).

6. **Update profile**:
   ```bash
   curl -s -X PUT http://localhost:3001/auth/me \
     -H "Authorization: Bearer <accessToken>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Updated Name"}'
   ```
   Expected: `200` with updated profile.

7. **Refresh token** (replace `<refreshToken>`):
   ```bash
   curl -s -X POST http://localhost:3001/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<refreshToken>"}'
   ```
   Expected: `200` with new `accessToken` and `refreshToken`. Old refresh token is rotated.

8. **Logout** (replace both tokens):
   ```bash
   curl -s -X POST http://localhost:3001/auth/logout \
     -H "Authorization: Bearer <accessToken>" \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<refreshToken>"}'
   ```
   Expected: `200`. Subsequent refresh with the same token returns `401`.

9. **Verify expired/invalid token**:
   ```bash
   curl -s http://localhost:3001/auth/me \
     -H "Authorization: Bearer invalid-token"
   ```
   Expected: `401` with `UNAUTHORIZED`.

10. **Health check**:
    ```bash
    curl -s http://localhost:3001/health
    ```
    Expected: `{"status":"ok","service":"auth-service"}`.

11. **Metrics endpoint**:
    ```bash
    curl -s http://localhost:3001/metrics
    ```
    Expected: Prometheus-format metrics output.

---

## Dependencies

- **None** — Auth Service is standalone
- **Consumed by:** API Gateway (token validation), all services indirectly
