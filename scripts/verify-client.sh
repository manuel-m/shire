#!/usr/bin/env bash
# Automated verification of client-service endpoints.
# Designed to run against a freshly started stack (make reset && make up).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

BASE_URL="${CLIENT_URL:-http://client-service:3002}"
AUTH_URL="${AUTH_URL:-http://auth-service:3001}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }

assert_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" -eq "$expected" ]; then
    green "  PASS  $label (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    red   "  FAIL  $label — expected $expected, got $actual"
    red   "        $body"
    FAIL=$((FAIL + 1))
  fi
}

assert_field() {
  local label="$1" body="$2" field="$3"
  if echo "$body" | grep -q "\"$field\""; then
    green "  PASS  $label — field '$field' present"
    PASS=$((PASS + 1))
  else
    red   "  FAIL  $label — field '$field' missing"
    FAIL=$((FAIL + 1))
  fi
}

assert_no_field() {
  local label="$1" body="$2" field="$3"
  if echo "$body" | grep -q "\"$field\""; then
    red   "  FAIL  $label — field '$field' should not be present"
    FAIL=$((FAIL + 1))
  else
    green "  PASS  $label — field '$field' absent"
    PASS=$((PASS + 1))
  fi
}

json_value() {
  # Minimal JSON value extractor (no jq dependency).
  python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])" 2>/dev/null <<< "$2"
}

# ── Obtain a JWT token ───────────────────────────────────────────────
# Try auth-service first; fall back to crafting a local dev token.
obtain_token() {
  # Try registering (or logging in if already registered) via auth-service
  if curl -sf "$AUTH_URL/health" >/dev/null 2>&1; then
    echo "Obtaining token from auth-service at $AUTH_URL ..." >&2
    local RESP BODY CODE
    RESP=$(curl -sw '\n%{http_code}' -X POST "$AUTH_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"email":"client-verify@example.com","password":"password123","name":"Client Verifier"}')
    BODY=$(echo "$RESP" | sed '$d')
    CODE=$(echo "$RESP" | tail -1)
    if [ "$CODE" -eq 201 ] || [ "$CODE" -eq 409 ]; then
      if [ "$CODE" -eq 409 ]; then
        RESP=$(curl -sw '\n%{http_code}' -X POST "$AUTH_URL/auth/login" \
          -H "Content-Type: application/json" \
          -d '{"email":"client-verify@example.com","password":"password123"}')
        BODY=$(echo "$RESP" | sed '$d')
      fi
      json_value accessToken "$BODY"
      return
    fi
  fi
  # Fallback: craft a dev token locally
  echo "Auth-service unavailable — crafting local dev token" >&2
  node -e "console.log(require('jsonwebtoken').sign({userId:'u1',email:'dev@test.com',role:'consultant'},'${JWT_SECRET:-dev-secret-change-me}'))"
}

TOKEN=$(obtain_token)
AUTH_HEADER="Authorization: Bearer $TOKEN"

# ── Wait for service ─────────────────────────────────────────────────
echo "Waiting for client-service at $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "client-service not reachable after 30s"; exit 1; fi
  sleep 1
done
echo ""

# ── 1. Health check ──────────────────────────────────────────────────
echo "1. Health check"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/health")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /health" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"client-service"' && {
  green "  PASS  service name is client-service"; PASS=$((PASS + 1))
} || {
  red "  FAIL  service name mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 2. Metrics endpoint ──────────────────────────────────────────────
echo "2. Metrics endpoint"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/metrics")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /metrics" 200 "$CODE" "$BODY"
echo ""

# ── 3. Create a client ───────────────────────────────────────────────
echo "3. Create a client"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/clients" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme Corp","industry":"Technology","technicalStack":["Node.js","MongoDB"]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /clients" 201 "$CODE" "$BODY"
assert_field "create client" "$BODY" "companyName"
assert_field "create client" "$BODY" "_id"
CLIENT_ID=$(json_value _id "$BODY")
echo ""

# ── 4. Duplicate company name ────────────────────────────────────────
echo "4. Duplicate company name"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/clients" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme Corp","technicalStack":[]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /clients (duplicate)" 409 "$CODE" "$BODY"
echo ""

# ── 5. Create second client for listing ──────────────────────────────
echo "5. Create second client"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/clients" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Beta Inc","industry":"Finance","technicalStack":["Python"]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /clients (second)" 201 "$CODE" "$BODY"
echo ""

# ── 6. List clients with filter ──────────────────────────────────────
echo "6. List clients with industry filter"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients?industry=Technology&page=1&limit=10" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients?industry=Technology" 200 "$CODE" "$BODY"
assert_field "list response" "$BODY" "data"
assert_field "list response" "$BODY" "total"
assert_no_field "list response" "$BODY" "codeCredentials"
echo ""

# ── 7. List clients with companyName filter ──────────────────────────
echo "7. List clients with companyName filter"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients?companyName=Beta" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients?companyName=Beta" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"Beta Inc"' && {
  green "  PASS  companyName filter works"; PASS=$((PASS + 1))
} || {
  red "  FAIL  companyName filter not working"; FAIL=$((FAIL + 1))
}
echo ""

# ── 8. Get client by ID ─────────────────────────────────────────────
echo "8. Get client by ID"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients/$CLIENT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients/:id" 200 "$CODE" "$BODY"
assert_no_field "get client" "$BODY" "codeCredentials"
echo ""

# ── 9. Get non-existent client ───────────────────────────────────────
echo "9. Get non-existent client"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients/does-not-exist" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients/:id (404)" 404 "$CODE" "$BODY"
echo ""

# ── 10. Update client ────────────────────────────────────────────────
echo "10. Update client"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/clients/$CLIENT_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"industry":"FinTech"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /clients/:id" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"FinTech"' && {
  green "  PASS  industry updated correctly"; PASS=$((PASS + 1))
} || {
  red "  FAIL  industry not updated"; FAIL=$((FAIL + 1))
}
echo ""

# ── 11. Add a contact ────────────────────────────────────────────────
echo "11. Add a contact"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/clients/$CLIENT_ID/contacts" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@acme.com","role":"CTO"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /clients/:id/contacts" 201 "$CODE" "$BODY"
assert_field "create contact" "$BODY" "name"
CONTACT_ID=$(json_value _id "$BODY")
echo ""

# ── 12. Add contact to non-existent client ───────────────────────────
echo "12. Add contact to non-existent client"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/clients/does-not-exist/contacts" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nobody","email":"nobody@test.com"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /clients/:id/contacts (missing client)" 404 "$CODE" "$BODY"
echo ""

# ── 13. List contacts ────────────────────────────────────────────────
echo "13. List contacts"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients/$CLIENT_ID/contacts" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients/:id/contacts" 200 "$CODE" "$BODY"
echo ""

# ── 14. Update a contact ─────────────────────────────────────────────
echo "14. Update a contact"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/clients/$CLIENT_ID/contacts/$CONTACT_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Updated"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /clients/:id/contacts/:contactId" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"Jane Updated"' && {
  green "  PASS  contact name updated"; PASS=$((PASS + 1))
} || {
  red "  FAIL  contact name not updated"; FAIL=$((FAIL + 1))
}
echo ""

# ── 15. Delete a contact ─────────────────────────────────────────────
echo "15. Delete a contact"
RESP=$(curl -sw '\n%{http_code}' -X DELETE "$BASE_URL/clients/$CLIENT_ID/contacts/$CONTACT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "DELETE /clients/:id/contacts/:contactId" 204 "$CODE" "$BODY"
echo ""

# ── 16. Store credentials ────────────────────────────────────────────
echo "16. Store credentials"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/clients/$CLIENT_ID/credentials" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"repoUrls":["https://github.com/acme/repo"],"sshKeys":["ssh-rsa AAAA-test-key"],"tokens":["ghp_abc123"]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /clients/:id/credentials" 200 "$CODE" "$BODY"
echo ""

# ── 17. Retrieve credentials ─────────────────────────────────────────
echo "17. Retrieve credentials (decrypted)"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients/$CLIENT_ID/credentials" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients/:id/credentials" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"ssh-rsa AAAA-test-key"' && {
  green "  PASS  sshKeys decrypted correctly"; PASS=$((PASS + 1))
} || {
  red "  FAIL  sshKeys not decrypted"; FAIL=$((FAIL + 1))
}
echo "$BODY" | grep -q '"ghp_abc123"' && {
  green "  PASS  tokens decrypted correctly"; PASS=$((PASS + 1))
} || {
  red "  FAIL  tokens not decrypted"; FAIL=$((FAIL + 1))
}
echo "$BODY" | grep -q '"https://github.com/acme/repo"' && {
  green "  PASS  repoUrls returned as-is"; PASS=$((PASS + 1))
} || {
  red "  FAIL  repoUrls missing"; FAIL=$((FAIL + 1))
}
echo ""

# ── 18. Retrieve credentials for non-existent client ─────────────────
echo "18. Retrieve credentials for non-existent client"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients/does-not-exist/credentials" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients/:id/credentials (404)" 404 "$CODE" "$BODY"
echo ""

# ── 19. Request without auth ─────────────────────────────────────────
echo "19. Request without auth header"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients (no auth)" 401 "$CODE" "$BODY"
echo ""

# ── 20. Delete client (cascade) ──────────────────────────────────────
echo "20. Delete client"
# Re-add a contact so we can verify cascade
curl -s -X POST "$BASE_URL/clients/$CLIENT_ID/contacts" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cascade Contact","email":"cascade@acme.com"}' >/dev/null

RESP=$(curl -sw '\n%{http_code}' -X DELETE "$BASE_URL/clients/$CLIENT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "DELETE /clients/:id" 204 "$CODE" "$BODY"

# Verify client is gone
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/clients/$CLIENT_ID" \
  -H "$AUTH_HEADER")
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /clients/:id (after delete)" 404 "$CODE" "$(echo "$RESP" | sed '$d')"
echo ""

# ── 21. Delete non-existent client ───────────────────────────────────
echo "21. Delete non-existent client"
RESP=$(curl -sw '\n%{http_code}' -X DELETE "$BASE_URL/clients/does-not-exist" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "DELETE /clients/:id (404)" 404 "$CODE" "$BODY"
echo ""

# ── Summary ───────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  green "All $TOTAL checks passed."
else
  red "$FAIL/$TOTAL checks failed."
  exit 1
fi
