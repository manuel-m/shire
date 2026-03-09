#!/usr/bin/env bash
# Automated verification of billing-service endpoints.
# Designed to run against a freshly started stack (make reset && make up).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

BASE_URL="${BILLING_URL:-http://billing-service:3005}"
ENGAGEMENT_URL="${ENGAGEMENT_URL:-http://engagement-service:3003}"
CLIENT_URL="${CLIENT_URL:-http://client-service:3002}"
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

assert_json_value() {
  local label="$1" body="$2" field="$3" expected="$4"
  local actual
  actual=$(json_value "$field" "$body")
  if [ "$actual" = "$expected" ]; then
    green "  PASS  $label — $field = $expected"
    PASS=$((PASS + 1))
  else
    red   "  FAIL  $label — $field expected '$expected', got '$actual'"
    FAIL=$((FAIL + 1))
  fi
}

json_value() {
  # Minimal JSON value extractor (no jq dependency).
  python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])" 2>/dev/null <<< "$2"
}

json_nested() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d$(printf "['%s']" $(echo "$1" | tr '.' ' ')))" 2>/dev/null <<< "$2"
}

# ── Obtain a JWT token ───────────────────────────────────────────────
obtain_token() {
  if curl -sf "$AUTH_URL/health" >/dev/null 2>&1; then
    echo "Obtaining token from auth-service at $AUTH_URL ..." >&2
    local RESP BODY CODE
    RESP=$(curl -sw '\n%{http_code}' -X POST "$AUTH_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"email":"billing-verify@example.com","password":"password123","name":"Billing Verifier"}')
    BODY=$(echo "$RESP" | sed '$d')
    CODE=$(echo "$RESP" | tail -1)
    if [ "$CODE" -eq 201 ] || [ "$CODE" -eq 409 ]; then
      if [ "$CODE" -eq 409 ]; then
        RESP=$(curl -sw '\n%{http_code}' -X POST "$AUTH_URL/auth/login" \
          -H "Content-Type: application/json" \
          -d '{"email":"billing-verify@example.com","password":"password123"}')
        BODY=$(echo "$RESP" | sed '$d')
      fi
      json_value accessToken "$BODY"
      return
    fi
  fi
  echo "Auth-service unavailable — crafting local dev token" >&2
  node -e "console.log(require('jsonwebtoken').sign({userId:'u1',email:'dev@test.com',role:'consultant'},'${JWT_SECRET:-dev-secret-change-me}'))"
}

TOKEN=$(obtain_token)
AUTH_HEADER="Authorization: Bearer $TOKEN"

# ── Wait for services ────────────────────────────────────────────────
echo "Waiting for billing-service at $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "billing-service not reachable after 30s"; exit 1; fi
  sleep 1
done

echo "Waiting for client-service at $CLIENT_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$CLIENT_URL/health" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "client-service not reachable after 30s"; exit 1; fi
  sleep 1
done

echo "Waiting for engagement-service at $ENGAGEMENT_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$ENGAGEMENT_URL/health" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "engagement-service not reachable after 30s"; exit 1; fi
  sleep 1
done
echo ""

# ── Setup: create a client ───────────────────────────────────────────
echo "Setup: Creating a test client"
RESP=$(curl -sw '\n%{http_code}' -X POST "$CLIENT_URL/clients" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Billing Verify Corp","industry":"Technology","technicalStack":["Node.js"]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
if [ "$CODE" -eq 409 ]; then
  RESP=$(curl -sw '\n%{http_code}' "$CLIENT_URL/clients?companyName=Billing%20Verify%20Corp" \
    -H "$AUTH_HEADER")
  BODY=$(echo "$RESP" | sed '$d')
  CLIENT_ID=$(python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['_id'])" <<< "$BODY")
else
  CLIENT_ID=$(json_value _id "$BODY")
fi
green "  Test client ID: $CLIENT_ID"

# ── Setup: create an engagement ──────────────────────────────────────
echo "Setup: Creating a test engagement"
RESP=$(curl -sw '\n%{http_code}' -X POST "$ENGAGEMENT_URL/engagements" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"type\":\"diagnostic\",\"accessType\":\"black-box\",\"description\":\"Billing verify audit\",\"priority\":\"high\"}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
ENGAGEMENT_ID=$(json_value _id "$BODY")
green "  Test engagement ID: $ENGAGEMENT_ID"
echo ""

# ── 1. Health check ──────────────────────────────────────────────────
echo "1. Health check"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/health")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /health" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"billing-service"' && {
  green "  PASS  service name is billing-service"; PASS=$((PASS + 1))
} || {
  red "  FAIL  service name mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 2. Metrics endpoint ─────────────────────────────────────────────
echo "2. Metrics endpoint"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/metrics")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /metrics" 200 "$CODE" "$BODY"
echo ""

# ── 3. Request without auth (401) ────────────────────────────────────
echo "3. Request without auth header"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices (no auth)" 401 "$CODE" "$BODY"
echo ""

# ── 4. Create an invoice ─────────────────────────────────────────────
echo "4. Create an invoice"
ISSUE_DATE=$(python3 -c "from datetime import datetime,timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))")
DUE_DATE=$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"engagementId\":\"$ENGAGEMENT_ID\",\"currency\":\"EUR\",\"issueDate\":\"$ISSUE_DATE\",\"dueDate\":\"$DUE_DATE\",\"lineItems\":[{\"description\":\"Security audit\",\"quantity\":5,\"unitPrice\":1000,\"total\":5000},{\"description\":\"Report writing\",\"quantity\":2,\"unitPrice\":500,\"total\":1000}]}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices" 201 "$CODE" "$BODY"
assert_field "create invoice" "$BODY" "_id"
assert_json_value "create invoice" "$BODY" "status" "draft"
assert_field "create invoice" "$BODY" "invoiceNumber"
INVOICE_ID=$(json_value _id "$BODY")
AMOUNT=$(json_value amount "$BODY")
[ "$AMOUNT" = "6000" ] && {
  green "  PASS  amount computed correctly ($AMOUNT)"; PASS=$((PASS + 1))
} || {
  red "  FAIL  amount expected 6000, got $AMOUNT"; FAIL=$((FAIL + 1))
}
echo ""

# ── 5. Create with non-existent client (404) ─────────────────────────
echo "5. Create with non-existent client"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"non-existent\",\"engagementId\":\"$ENGAGEMENT_ID\",\"currency\":\"EUR\",\"issueDate\":\"$ISSUE_DATE\",\"dueDate\":\"$DUE_DATE\",\"lineItems\":[{\"description\":\"Test\",\"quantity\":1,\"unitPrice\":100,\"total\":100}]}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices (missing client)" 404 "$CODE" "$BODY"
echo "$BODY" | grep -q '"CLIENT_NOT_FOUND"' && {
  green "  PASS  error code is CLIENT_NOT_FOUND"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 6. Create with non-existent engagement (404) ─────────────────────
echo "6. Create with non-existent engagement"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"engagementId\":\"non-existent\",\"currency\":\"EUR\",\"issueDate\":\"$ISSUE_DATE\",\"dueDate\":\"$DUE_DATE\",\"lineItems\":[{\"description\":\"Test\",\"quantity\":1,\"unitPrice\":100,\"total\":100}]}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices (missing engagement)" 404 "$CODE" "$BODY"
echo "$BODY" | grep -q '"ENGAGEMENT_NOT_FOUND"' && {
  green "  PASS  error code is ENGAGEMENT_NOT_FOUND"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 7. Invalid input (400) ───────────────────────────────────────────
echo "7. Invalid input"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"x"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices (invalid)" 400 "$CODE" "$BODY"
echo ""

# ── 8. List invoices with pagination ─────────────────────────────────
echo "8. List invoices with pagination"
# Create a second invoice
curl -s -X POST "$BASE_URL/invoices" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"engagementId\":\"$ENGAGEMENT_ID\",\"currency\":\"USD\",\"issueDate\":\"$ISSUE_DATE\",\"dueDate\":\"$DUE_DATE\",\"lineItems\":[{\"description\":\"Consulting\",\"quantity\":1,\"unitPrice\":2000,\"total\":2000}]}" >/dev/null

RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices?page=1&limit=1" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices?page=1&limit=1" 200 "$CODE" "$BODY"
assert_field "list response" "$BODY" "data"
assert_field "list response" "$BODY" "total"
echo ""

# ── 9. Filter by status ──────────────────────────────────────────────
echo "9. Filter by status"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices?status=draft" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices?status=draft" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"draft"' && {
  green "  PASS  status filter works"; PASS=$((PASS + 1))
} || {
  red "  FAIL  status filter not working"; FAIL=$((FAIL + 1))
}
echo ""

# ── 10. Filter by clientId ────────────────────────────────────────────
echo "10. Filter by clientId"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices?clientId=$CLIENT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices?clientId=..." 200 "$CODE" "$BODY"
TOTAL=$(json_value total "$BODY")
[ "$TOTAL" -ge 2 ] && {
  green "  PASS  clientId filter returns $TOTAL invoices"; PASS=$((PASS + 1))
} || {
  red "  FAIL  expected ≥2 invoices, got $TOTAL"; FAIL=$((FAIL + 1))
}
echo ""

# ── 11. Get invoice by ID ─────────────────────────────────────────────
echo "11. Get invoice by ID"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices/$INVOICE_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices/:id" 200 "$CODE" "$BODY"
assert_json_value "get invoice" "$BODY" "currency" "EUR"
echo ""

# ── 12. Get non-existent invoice (404) ────────────────────────────────
echo "12. Get non-existent invoice"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices/does-not-exist" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices/:id (404)" 404 "$CODE" "$BODY"
echo ""

# ── 13. Get invoices by client ────────────────────────────────────────
echo "13. Get invoices by client"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices/client/$CLIENT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices/client/:clientId" 200 "$CODE" "$BODY"
echo ""

# ── 14. Get invoices by engagement ────────────────────────────────────
echo "14. Get invoices by engagement"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/invoices/engagement/$ENGAGEMENT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /invoices/engagement/:engagementId" 200 "$CODE" "$BODY"
echo ""

# ── 15. Update a draft invoice ────────────────────────────────────────
echo "15. Update a draft invoice"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/invoices/$INVOICE_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"currency":"GBP","lineItems":[{"description":"Updated audit","quantity":10,"unitPrice":1000,"total":10000}]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /invoices/:id" 200 "$CODE" "$BODY"
assert_json_value "update invoice" "$BODY" "currency" "GBP"
AMOUNT=$(json_value amount "$BODY")
[ "$AMOUNT" = "10000" ] && {
  green "  PASS  amount recomputed ($AMOUNT)"; PASS=$((PASS + 1))
} || {
  red "  FAIL  amount expected 10000, got $AMOUNT"; FAIL=$((FAIL + 1))
}
echo ""

# ── 16. Status transition: draft → issued ─────────────────────────────
echo "16. Status transition: draft → issued"
RESP=$(curl -sw '\n%{http_code}' -X PATCH "$BASE_URL/invoices/$INVOICE_ID/status" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"status":"issued"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PATCH /invoices/:id/status (→issued)" 200 "$CODE" "$BODY"
assert_json_value "status transition" "$BODY" "status" "issued"
echo ""

# ── 17. Try to update non-draft invoice (422) ─────────────────────────
echo "17. Update non-draft invoice (422)"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/invoices/$INVOICE_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /invoices/:id (non-draft)" 422 "$CODE" "$BODY"
echo "$BODY" | grep -q '"NOT_EDITABLE"' && {
  green "  PASS  error code is NOT_EDITABLE"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 18. Invalid status transition (422) ───────────────────────────────
echo "18. Invalid status transition: issued → draft"
RESP=$(curl -sw '\n%{http_code}' -X PATCH "$BASE_URL/invoices/$INVOICE_ID/status" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"status":"draft"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PATCH /invoices/:id/status (invalid)" 422 "$CODE" "$BODY"
echo "$BODY" | grep -q '"INVALID_STATUS_TRANSITION"' && {
  green "  PASS  error code is INVALID_STATUS_TRANSITION"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 19. Send invoice (issued → pending-payment) ──────────────────────
echo "19. Send invoice"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices/$INVOICE_ID/send" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices/:id/send" 200 "$CODE" "$BODY"
assert_json_value "send invoice" "$BODY" "status" "pending-payment"
echo ""

# ── 20. Send non-issued invoice (422) ─────────────────────────────────
echo "20. Send non-issued invoice (422)"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices/$INVOICE_ID/send" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices/:id/send (not issued)" 422 "$CODE" "$BODY"
echo "$BODY" | grep -q '"INVALID_OPERATION"' && {
  green "  PASS  error code is INVALID_OPERATION"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 21. Send payment reminder ─────────────────────────────────────────
echo "21. Send payment reminder"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices/$INVOICE_ID/remind" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices/:id/remind" 200 "$CODE" "$BODY"
assert_field "reminder" "$BODY" "message"
echo ""

# ── 22. Status transition: pending-payment → paid ─────────────────────
echo "22. Status transition: pending-payment → paid"
RESP=$(curl -sw '\n%{http_code}' -X PATCH "$BASE_URL/invoices/$INVOICE_ID/status" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"status":"paid"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PATCH /invoices/:id/status (→paid)" 200 "$CODE" "$BODY"
assert_json_value "status transition" "$BODY" "status" "paid"
assert_field "paid invoice" "$BODY" "paidDate"
echo ""

# ── 23. Remind on paid invoice (422) ──────────────────────────────────
echo "23. Remind on paid invoice (422)"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/invoices/$INVOICE_ID/remind" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /invoices/:id/remind (paid)" 422 "$CODE" "$BODY"
echo "$BODY" | grep -q '"INVALID_OPERATION"' && {
  green "  PASS  error code is INVALID_OPERATION"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── Summary ──────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  green "All $TOTAL checks passed."
else
  red "$FAIL/$TOTAL checks failed."
  exit 1
fi
