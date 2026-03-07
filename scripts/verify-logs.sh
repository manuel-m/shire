#!/usr/bin/env bash
# Verify that logs are flowing through the Loki pipeline.
# Run after verify-auth to ensure log entries were produced.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

LOKI_URL="${LOKI_URL:-http://localhost:${LOKI_PORT:-3101}}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }

assert() {
  local label="$1" ok="$2"
  if [ "$ok" = "true" ]; then
    green "  PASS  $label"
    PASS=$((PASS + 1))
  else
    red   "  FAIL  $label"
    FAIL=$((FAIL + 1))
  fi
}

# ── Wait for Loki ────────────────────────────────────────────────────
echo "Waiting for Loki at $LOKI_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$LOKI_URL/ready" >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then red "Loki not reachable after 30s"; exit 1; fi
  sleep 1
done
echo ""

# ── 1. Query Loki for auth-service logs (retry up to 30s) ─────────────
echo "1. Querying Loki for auth-service container logs"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

RESULT_COUNT=0
MAX_TRIES=50
for attempt in $(seq 1 $MAX_TRIES); do
  NOW=$(date +%s)
  START=$((NOW - 3600))
  curl -sG "$LOKI_URL/loki/api/v1/query_range" \
    --data-urlencode "query={container=~\".*auth.*\"}" \
    --data-urlencode "start=${START}" \
    --data-urlencode "end=${NOW}" \
    --data-urlencode "limit=50" \
    -o "$TMPFILE"

  RESULT_COUNT=$(python3 -c "
import json
with open('$TMPFILE') as f:
    data = json.load(f)
streams = data.get('data', {}).get('result', [])
print(sum(len(s.get('values', [])) for s in streams))
" 2>/dev/null || echo "0")

  if [ "$RESULT_COUNT" -gt 0 ]; then break; fi
  echo "   waiting for log ingestion ... ($attempt/$MAX_TRIES)"
  sleep 2
done

assert "Loki returned log entries (got $RESULT_COUNT)" "$([ "$RESULT_COUNT" -gt 0 ] && echo true || echo false)"
echo ""

# ── 2. Check logs contain structured fields ──────────────────────────
echo "2. Checking structured log fields"
HAS_FIELDS=$(python3 -c "
import json
with open('$TMPFILE') as f:
    data = json.load(f)
for stream in data.get('data', {}).get('result', []):
    for _, line in stream.get('values', []):
        try:
            entry = json.loads(line)
            if 'service' in entry and 'level' in entry and 'message' in entry:
                print('true')
                raise SystemExit(0)
        except json.JSONDecodeError:
            continue
print('false')
" 2>/dev/null || echo "false")

assert "Logs contain structured fields (service, level, message)" "$HAS_FIELDS"
echo ""

# ── 3. Check that we see 'info' level logs (registration/login) ──────
echo "3. Checking for info-level log entries"
HAS_INFO=$(python3 -c "
import json
with open('$TMPFILE') as f:
    data = json.load(f)
for stream in data.get('data', {}).get('result', []):
    for _, line in stream.get('values', []):
        try:
            entry = json.loads(line)
            if entry.get('level') == 'info':
                print('true')
                raise SystemExit(0)
        except json.JSONDecodeError:
            continue
print('false')
" 2>/dev/null || echo "false")

assert "Found info-level logs from auth-service" "$HAS_INFO"
echo ""

# ── 4. Verify Loki labels include container ──────────────────────────
echo "4. Checking Loki labels"
curl -s "$LOKI_URL/loki/api/v1/labels" -o "$TMPFILE"
HAS_CONTAINER=$(python3 -c "
import json
with open('$TMPFILE') as f:
    data = json.load(f)
print('true' if 'container' in data.get('data', []) else 'false')
" 2>/dev/null || echo "false")

assert "Loki has 'container' label" "$HAS_CONTAINER"
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
