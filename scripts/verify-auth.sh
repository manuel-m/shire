#!/usr/bin/env bash
# Automated verification of auth-service endpoints.
# Designed to run against a freshly started stack (make reset && make up).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

BASE_URL="${AUTH_URL:-http://auth-service:3001}"
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
  # Usage: json_value 'key' <<< "$json"
  python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])" 2>/dev/null <<< "$2"
}

# ── Wait for service ─────────────────────────────────────────────────
echo "Waiting for auth-service at $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "auth-service not reachable after 30s"; exit 1; fi
  sleep 1
done
echo ""

# ── 1. Health check ──────────────────────────────────────────────────
echo "1. Health check"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/health")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /health" 200 "$CODE" "$BODY"
echo ""

# ── 2. Metrics endpoint ──────────────────────────────────────────────
echo "2. Metrics endpoint"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/metrics")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /metrics" 200 "$CODE" "$BODY"
echo ""

# ── 3. Register ──────────────────────────────────────────────────────
echo "3. Register a new user"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"password123","name":"Verify User"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/register" 201 "$CODE" "$BODY"
assert_field "register response" "$BODY" "accessToken"
assert_field "register response" "$BODY" "refreshToken"
assert_no_field "register response" "$BODY" "passwordHash"
REG_ACCESS=$(json_value accessToken "$BODY")
REG_REFRESH=$(json_value refreshToken "$BODY")
echo ""

# ── 4. Register duplicate ────────────────────────────────────────────
echo "4. Register duplicate email"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"password123","name":"Verify User"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/register (duplicate)" 409 "$CODE" "$BODY"
echo ""

# ── 5. Register validation error ─────────────────────────────────────
echo "5. Register with invalid input"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"bad"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/register (invalid)" 400 "$CODE" "$BODY"
echo ""

# ── 6. Login ──────────────────────────────────────────────────────────
echo "6. Login"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"password123"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/login" 200 "$CODE" "$BODY"
assert_field "login response" "$BODY" "accessToken"
assert_field "login response" "$BODY" "refreshToken"
ACCESS=$(json_value accessToken "$BODY")
REFRESH=$(json_value refreshToken "$BODY")
echo ""

# ── 7. Login wrong password ──────────────────────────────────────────
echo "7. Login with wrong password"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"wrong"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/login (wrong password)" 401 "$CODE" "$BODY"
echo ""

# ── 8. Login non-existent user ────────────────────────────────────────
echo "8. Login non-existent user"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"test"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/login (non-existent)" 401 "$CODE" "$BODY"
echo ""

# ── 9. Get profile ────────────────────────────────────────────────────
echo "9. Get profile"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $ACCESS")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /auth/me" 200 "$CODE" "$BODY"
assert_field "profile" "$BODY" "email"
assert_no_field "profile" "$BODY" "passwordHash"
echo ""

# ── 10. Get profile without token ──────────────────────────────────────
echo "10. Get profile without token"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/auth/me")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /auth/me (no token)" 401 "$CODE" "$BODY"
echo ""

# ── 11. Get profile with invalid token ──────────────────────────────────
echo "11. Get profile with invalid token"
RESP=$(curl -sw '\n%{http_code}' "$BASE_URL/auth/me" \
  -H "Authorization: Bearer invalid-token")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "GET /auth/me (invalid token)" 401 "$CODE" "$BODY"
echo ""

# ── 12. Update profile ────────────────────────────────────────────────
echo "12. Update profile"
RESP=$(curl -sw '\n%{http_code}' -X PUT "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "PUT /auth/me" 200 "$CODE" "$BODY"
echo "$BODY" | grep -q '"Updated Name"' && {
  green "  PASS  name updated correctly"; PASS=$((PASS + 1))
} || {
  red "  FAIL  name not updated"; FAIL=$((FAIL + 1))
}
echo ""

# ── 13. Refresh token ─────────────────────────────────────────────────
echo "13. Refresh token"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/refresh" 200 "$CODE" "$BODY"
NEW_ACCESS=$(json_value accessToken "$BODY")
NEW_REFRESH=$(json_value refreshToken "$BODY")
echo ""

# ── 14. Old refresh token is invalidated (rotation) ───────────────────
echo "14. Old refresh token rejected after rotation"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/refresh (old token)" 401 "$CODE" "$BODY"
echo ""

# ── 15. Invalid refresh token ─────────────────────────────────────────
echo "15. Invalid refresh token"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"bogus"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/refresh (invalid)" 401 "$CODE" "$BODY"
echo ""

# ── 16. Logout ─────────────────────────────────────────────────────────
echo "16. Logout"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $NEW_ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/logout" 200 "$CODE" "$BODY"
echo ""

# ── 17. Refresh after logout fails ────────────────────────────────────
echo "17. Refresh after logout fails"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/refresh (after logout)" 401 "$CODE" "$BODY"
echo ""

# ── 18. Logout without auth header ────────────────────────────────────
echo "18. Logout without auth header"
RESP=$(curl -sw '\n%{http_code}' -X POST "$BASE_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"x"}')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
assert_status "POST /auth/logout (no auth)" 401 "$CODE" "$BODY"
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
