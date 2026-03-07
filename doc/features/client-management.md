# Feature: Client Management

## Overview

The Client Service manages consulting clients, their associated contacts, and securely stored code credentials. A client represents a company receiving consulting services and may have multiple contacts and engagements.

**Source:** PRD Section 5.1, prompts0.md (Client Management).

---

## User Stories

1. **As a consultant**, I want to create a new client with company details so that I can track their information.
2. **As a consultant**, I want to view a list of all clients so that I can find and manage them.
3. **As a consultant**, I want to view a client's details including contacts and technical stack.
4. **As a consultant**, I want to edit a client's information as it changes.
5. **As a consultant**, I want to add contacts (people) to a client so that I know who to communicate with.
6. **As a consultant**, I want to store code credentials (repo URLs, SSH keys, tokens) for a client so that I can access their systems during engagements.
7. **As a consultant**, I want code credentials to be encrypted and access-logged for security.

---

## Data Model

### Clients Collection

```typescript
const ClientSchema = z.object({
  _id: z.string(),
  companyName: z.string(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  technicalStack: z.array(z.string()),
  notes: z.string().optional(),
  codeCredentials: z.object({
    repoUrls: z.array(z.string()).optional(),
    sshKeys: z.array(z.string()).optional(),    // encrypted at rest
    tokens: z.array(z.string()).optional(),      // encrypted at rest
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### Contacts Collection

```typescript
const ContactSchema = z.object({
  _id: z.string(),
  clientId: z.string(),
  name: z.string(),
  role: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /clients | Create client |
| GET | /clients | List clients (paginated, filterable) |
| GET | /clients/:id | Get client details |
| PUT | /clients/:id | Update client |
| DELETE | /clients/:id | Delete client |
| POST | /clients/:id/contacts | Add contact |
| GET | /clients/:id/contacts | List contacts for client |
| PUT | /clients/:id/contacts/:contactId | Update contact |
| DELETE | /clients/:id/contacts/:contactId | Delete contact |
| PUT | /clients/:id/credentials | Update code credentials |
| GET | /clients/:id/credentials | Get code credentials (access-logged) |

---

## Business Rules

1. `companyName` is required and must be unique.
2. A client cannot be deleted if it has active engagements.
3. Code credentials (`sshKeys`, `tokens`) must be encrypted at rest using AES-256.
4. Every access to code credentials (GET `/clients/:id/credentials`) must be logged with the requesting user ID, timestamp, and client ID.
5. Contacts are scoped to a client; deleting a client cascades to its contacts.
6. `technicalStack` is a free-form array (e.g., `["Python", "FastAPI", "OpenAI", "PostgreSQL"]`).

---

## Acceptance Criteria

- [ ] CRUD operations work for clients and contacts
- [ ] Client list supports pagination and filtering by industry/name
- [ ] Code credentials are stored encrypted in the database
- [ ] Accessing credentials creates an audit log entry
- [ ] Deleting a client with active engagements returns 409
- [ ] Duplicate company names return 409

---

## How to Verify

Start the service:
```bash
pnpm --filter @shire/client-service dev
```

First, get a JWT token from the auth service (or craft one for local dev):
```bash
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({userId:'u1',email:'dev@test.com',role:'consultant'},'dev-secret-change-me'))")
```

1. **Create a client:**
   ```bash
   curl -s -X POST http://localhost:3002/clients \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"companyName":"Acme Corp","industry":"Technology","technicalStack":["Node.js","MongoDB"]}'
   ```
   Expected: `201` with the created client object. Save the `_id`.

2. **Duplicate company name (409):**
   ```bash
   curl -s -X POST http://localhost:3002/clients \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"companyName":"Acme Corp","technicalStack":[]}'
   ```
   Expected: `409` with `DUPLICATE_NAME`.

3. **List clients with filters:**
   ```bash
   curl -s "http://localhost:3002/clients?industry=Technology&page=1&limit=10" \
     -H "Authorization: Bearer $TOKEN"
   ```
   Expected: `200` with paginated response, `codeCredentials` absent.

4. **Get client by ID** (replace `<id>`):
   ```bash
   curl -s http://localhost:3002/clients/<id> \
     -H "Authorization: Bearer $TOKEN"
   ```
   Expected: `200` with client details, no `codeCredentials`.

5. **Update client:**
   ```bash
   curl -s -X PUT http://localhost:3002/clients/<id> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"industry":"FinTech"}'
   ```
   Expected: `200` with updated client.

6. **Add a contact:**
   ```bash
   curl -s -X POST http://localhost:3002/clients/<id>/contacts \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Jane Doe","email":"jane@acme.com","role":"CTO"}'
   ```
   Expected: `201` with contact object. Save the contact `_id`.

7. **List contacts:**
   ```bash
   curl -s http://localhost:3002/clients/<id>/contacts \
     -H "Authorization: Bearer $TOKEN"
   ```
   Expected: `200` with array of contacts.

8. **Update a contact** (replace `<contactId>`):
   ```bash
   curl -s -X PUT http://localhost:3002/clients/<id>/contacts/<contactId> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Jane Updated"}'
   ```
   Expected: `200` with updated contact.

9. **Delete a contact:**
   ```bash
   curl -s -X DELETE http://localhost:3002/clients/<id>/contacts/<contactId> \
     -H "Authorization: Bearer $TOKEN"
   ```
   Expected: `204`.

10. **Store credentials:**
    ```bash
    curl -s -X PUT http://localhost:3002/clients/<id>/credentials \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"repoUrls":["https://github.com/acme/repo"],"sshKeys":["ssh-rsa AAAA..."],"tokens":["ghp_abc123"]}'
    ```
    Expected: `200` with `"Credentials updated"`.

11. **Retrieve credentials:**
    ```bash
    curl -s http://localhost:3002/clients/<id>/credentials \
      -H "Authorization: Bearer $TOKEN"
    ```
    Expected: `200` with decrypted credentials (plaintext `sshKeys` and `tokens`).

12. **Delete client:**
    ```bash
    curl -s -X DELETE http://localhost:3002/clients/<id> \
      -H "Authorization: Bearer $TOKEN"
    ```
    Expected: `204`. Contacts are cascade-deleted.

13. **Health check:**
    ```bash
    curl -s http://localhost:3002/health
    ```
    Expected: `{"status":"ok","service":"client-service"}`.

14. **Metrics endpoint:**
    ```bash
    curl -s http://localhost:3002/metrics
    ```
    Expected: Prometheus-format metrics output.

---

## Dependencies

- **None** — Client Service is standalone
- **Consumed by:** Engagement Service, Report Service, Billing Service, Analytics Service
