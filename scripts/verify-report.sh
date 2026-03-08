#!/usr/bin/env bash
# Automated verification of report-service endpoints.
# Designed to run against a freshly started stack (make reset && make up).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

BASE_URL="${REPORT_URL:-http://localhost:${REPORT_SERVICE_PORT:-3004}}"
ENGAGEMENT_URL="${ENGAGEMENT_URL:-http://localhost:${ENGAGEMENT_SERVICE_PORT:-3003}}"
CLIENT_URL="${CLIENT_URL:-http://localhost:${CLIENT_SERVICE_PORT:-3002}}"
AUTH_URL="${AUTH_URL:-http://localhost:${AUTH_SERVICE_PORT:-3001}}"
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
  # Extract nested value e.g. json_nested "error.code" "$BODY"
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d$(printf "['%s']" $(echo "$1" | tr '.' ' ')))" 2>/dev/null <<< "$2"
}

# ── Obtain a JWT token ───────────────────────────────────────────────
obtain_token() {
  if curl -sf "$AUTH_URL/health" >/dev/null 2>&1; then
    echo "Obtaining token from auth-service at $AUTH_URL ..." >&2
    local RESP BODY CODE
    RESP=$(curl -sw '\n%{http_code}' -X POST "$AUTH_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"email":"report-verify@example.com","password":"password123","name":"Report Verifier"}')
    BODY=$(echo "$RESP" | sed '$d')
    CODE=$(echo "$RESP" | tail -1)
    if [ "$CODE" -eq 201 ] || [ "$CODE" -eq 409 ]; then
      if [ "$CODE" -eq 409 ]; then
        RESP=$(curl -sw '\n%{http_code}' -X POST "$AUTH_URL/auth/login" \
          -H "Content-Type: application/json" \
          -d '{"email":"report-verify@example.com","password":"password123"}')
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
echo "Waiting for report-service at $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "report-service not reachable after 30s"; exit 1; fi
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
  -d '{"companyName":"Report Verify Corp","industry":"Technology","technicalStack":["Node.js"]}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
if [ "$CODE" -eq 409 ]; then
  RESP=$(curl -sw '\n%{http_code}' "$CLIENT_URL/clients?companyName=Report%20Verify%20Corp" \
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
  -d "{\"clientId\":\"$CLIENT_ID\",\"type\":\"diagnostic\",\"accessType\":\"black-box\",\"description\":\"Report verify audit\",\"priority\":\"high\"}")
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
echo "$BODY" | grep -q '"report-service"' && {
  green "  PASS  service name is report-service"; PASS=$((PASS + 1))
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

# ── 3. Create a report ──────────────────────────────────────────────
echo "3. Create a report"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/reports" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"engagementId\":\"$ENGAGEMENT_ID\",\"clientId\":\"$CLIENT_ID\",\"title\":\"Security Audit Report\",\"sections\":{\"executiveSummary\":\"Overview of findings.\",\"problems\":[{\"title\":\"SQL Injection\",\"severity\":\"critical\",\"description\":\"Found SQL injection in login form\",\"impact\":\"Full database compromise\"}],\"recommendations\":[{\"title\":\"Use parameterized queries\",\"priority\":\"high\",\"description\":\"Replace string concatenation with parameterized queries\"}],\"actionPlan\":[{\"step\":1,\"title\":\"Fix login form\",\"description\":\"Parameterize the login query\",\"responsible\":\"Dev Team\"}]}}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /reports" 201 "$CODE" "$BODY"
assert_field "create report" "$BODY" "_id"
assert_json_value "create report" "$BODY" "version" "1"
assert_json_value "create report" "$BODY" "status" "draft"
assert_field "create report" "$BODY" "createdAt"
REPORT_ID=$(json_value _id "$BODY")
echo ""

# ── 4. Create with non-existent engagement (404) ─────────────────────
echo "4. Create with non-existent engagement"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/reports" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"engagementId\":\"non-existent\",\"clientId\":\"$CLIENT_ID\",\"title\":\"Test\",\"sections\":{\"executiveSummary\":\"Test\"}}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /reports (missing engagement)" 404 "$CODE" "$BODY"
echo "$BODY" | grep -q '"ENGAGEMENT_NOT_FOUND"' && {
  green "  PASS  error code is ENGAGEMENT_NOT_FOUND"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 5. Create with non-existent client (404) ─────────────────────────
echo "5. Create with non-existent client"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/reports" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"engagementId\":\"$ENGAGEMENT_ID\",\"clientId\":\"non-existent\",\"title\":\"Test\",\"sections\":{\"executiveSummary\":\"Test\"}}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /reports (missing client)" 404 "$CODE" "$BODY"
echo "$BODY" | grep -q '"CLIENT_NOT_FOUND"' && {
  green "  PASS  error code is CLIENT_NOT_FOUND"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 6. Invalid input (400) ───────────────────────────────────────────
echo "6. Invalid input"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/reports" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"title":"missing required fields"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /reports (invalid)" 400 "$CODE" "$BODY"
echo ""

# ── 7. Request without auth (401) ────────────────────────────────────
echo "7. Request without auth header"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports (no auth)" 401 "$CODE" "$BODY"
echo ""

# ── 8. List reports with pagination ──────────────────────────────────
echo "8. List reports with pagination"
# Create a second report for pagination testing
curl -s -X POST "$BASE_URL/reports" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"engagementId\":\"$ENGAGEMENT_ID\",\"clientId\":\"$CLIENT_ID\",\"title\":\"Second Report\",\"sections\":{\"executiveSummary\":\"Another report.\",\"problems\":[],\"recommendations\":[],\"actionPlan\":[]}}" >/dev/null

RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports?page=1&limit=1" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports?page=1&limit=1" 200 "$CODE" "$BODY"
assert_field "list response" "$BODY" "data"
assert_field "list response" "$BODY" "total"
echo ""

# ── 9. Filter by engagementId ────────────────────────────────────────
echo "9. Filter by engagementId"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports?engagementId=$ENGAGEMENT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports?engagementId=..." 200 "$CODE" "$BODY"
TOTAL=$(json_value total "$BODY")
[ "$TOTAL" -ge 2 ] && {
  green "  PASS  engagementId filter returns $TOTAL reports"; PASS=$((PASS + 1))
} || {
  red "  FAIL  expected ≥2 reports, got $TOTAL"; FAIL=$((FAIL + 1))
}
echo ""

# ── 10. Filter by status ─────────────────────────────────────────────
echo "10. Filter by status"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports?status=draft" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports?status=draft" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"draft"' && {
  green "  PASS  status filter works"; PASS=$((PASS + 1))
} || {
  red "  FAIL  status filter not working"; FAIL=$((FAIL + 1))
}
echo ""

# ── 11. Get report by ID ─────────────────────────────────────────────
echo "11. Get report by ID"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/$REPORT_ID" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id" 200 "$CODE" "$BODY"
assert_json_value "get report" "$BODY" "title" "Security Audit Report"
echo ""

# ── 12. Get non-existent report (404) ─────────────────────────────────
echo "12. Get non-existent report"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/does-not-exist" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id (404)" 404 "$CODE" "$BODY"
echo ""

# ── 13. Update a report (version increment) ──────────────────────────
echo "13. Update a report (creates new version)"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/reports/$REPORT_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Report Title","sections":{"executiveSummary":"Updated summary."}}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /reports/:id" 200 "$CODE" "$BODY"
assert_json_value "update report" "$BODY" "title" "Updated Report Title"
assert_json_value "version incremented" "$BODY" "version" "2"
# Verify sections merge — problems should still be present
echo "$BODY" | grep -q '"SQL Injection"' && {
  green "  PASS  sections merged (problems preserved)"; PASS=$((PASS + 1))
} || {
  red "  FAIL  sections not merged (problems lost)"; FAIL=$((FAIL + 1))
}
echo ""

# ── 14. Update non-existent report (404) ──────────────────────────────
echo "14. Update non-existent report"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/reports/does-not-exist" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"title":"Nope"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /reports/:id (404)" 404 "$CODE" "$BODY"
echo ""

# ── 15. List all versions ────────────────────────────────────────────
echo "15. List all versions"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/$REPORT_ID/versions" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id/versions" 200 "$CODE" "$BODY"
VERSION_COUNT=$(python3 -c "import sys,json; print(len(json.load(sys.stdin)))" <<< "$BODY")
[ "$VERSION_COUNT" -eq 2 ] && {
  green "  PASS  2 versions returned"; PASS=$((PASS + 1))
} || {
  red "  FAIL  expected 2 versions, got $VERSION_COUNT"; FAIL=$((FAIL + 1))
}
echo ""

# ── 16. Get specific version ─────────────────────────────────────────
echo "16. Get specific version (version 1)"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/$REPORT_ID/versions/1" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id/versions/1" 200 "$CODE" "$BODY"
assert_json_value "version 1" "$BODY" "version" "1"
assert_json_value "version 1 title" "$BODY" "title" "Security Audit Report"
echo ""

# ── 17. Get current version ──────────────────────────────────────────
echo "17. Get current version (version 2)"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/$REPORT_ID/versions/2" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id/versions/2" 200 "$CODE" "$BODY"
assert_json_value "version 2" "$BODY" "version" "2"
assert_json_value "version 2 title" "$BODY" "title" "Updated Report Title"
echo ""

# ── 18. Get non-existent version (404) ────────────────────────────────
echo "18. Get non-existent version"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/$REPORT_ID/versions/99" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id/versions/99 (404)" 404 "$CODE" "$BODY"
echo ""

# ── 19. Generate markdown ────────────────────────────────────────────
echo "19. Generate markdown"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/reports/$REPORT_ID/generate/markdown" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /reports/:id/generate/markdown" 200 "$CODE" "$BODY"
assert_field "markdown response" "$BODY" "markdown"
MARKDOWN=$(python3 -c "import sys,json; print(json.load(sys.stdin)['markdown'])" <<< "$BODY")
echo "$MARKDOWN" | grep -q '# Updated Report Title' && {
  green "  PASS  markdown contains report title"; PASS=$((PASS + 1))
} || {
  red "  FAIL  markdown missing report title"; FAIL=$((FAIL + 1))
}
echo "$MARKDOWN" | grep -q 'Executive Summary' && {
  green "  PASS  markdown contains Executive Summary section"; PASS=$((PASS + 1))
} || {
  red "  FAIL  markdown missing Executive Summary"; FAIL=$((FAIL + 1))
}
echo "$MARKDOWN" | grep -q 'SQL Injection' && {
  green "  PASS  markdown contains problems"; PASS=$((PASS + 1))
} || {
  red "  FAIL  markdown missing problems"; FAIL=$((FAIL + 1))
}
echo "$MARKDOWN" | grep -q 'Recommendations' && {
  green "  PASS  markdown contains recommendations section"; PASS=$((PASS + 1))
} || {
  red "  FAIL  markdown missing recommendations"; FAIL=$((FAIL + 1))
}
echo "$MARKDOWN" | grep -q 'Action Plan' && {
  green "  PASS  markdown contains action plan section"; PASS=$((PASS + 1))
} || {
  red "  FAIL  markdown missing action plan"; FAIL=$((FAIL + 1))
}
echo ""

# ── 20. Generate markdown for non-existent report (404) ───────────────
echo "20. Generate markdown for non-existent report"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/reports/does-not-exist/generate/markdown" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /reports/:id/generate/markdown (404)" 404 "$CODE" "$BODY"
echo ""

# ── 21. Update to review status (makes report immutable) ─────────────
echo "21. Set status to review"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/reports/$REPORT_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"status":"review"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /reports/:id (→review)" 200 "$CODE" "$BODY"
assert_json_value "status change" "$BODY" "status" "review"
echo ""

# ── 22. Try to update a non-draft report (422) ───────────────────────
echo "22. Update non-draft report (422)"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/reports/$REPORT_ID" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"title":"Should fail"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /reports/:id (immutable)" 422 "$CODE" "$BODY"
echo "$BODY" | grep -q '"IMMUTABLE_STATUS"' && {
  green "  PASS  error code is IMMUTABLE_STATUS"; PASS=$((PASS + 1))
} || {
  red "  FAIL  error code mismatch"; FAIL=$((FAIL + 1))
}
echo ""

# ── 23. Versions list after non-existent report (404) ─────────────────
echo "23. Versions for non-existent report"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/reports/does-not-exist/versions" \
  -H "$AUTH_HEADER")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /reports/:id/versions (404)" 404 "$CODE" "$BODY"
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
