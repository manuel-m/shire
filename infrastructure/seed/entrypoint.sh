#!/usr/bin/env bash
# Seed service entrypoint — runs all verify scripts sequentially.
set -euo pipefail

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }

SCRIPTS=(
  verify-auth.sh
  verify-logs.sh
  verify-client.sh
  verify-engagement.sh
  verify-report.sh
  verify-billing.sh
)

FAILED=0

for script in "${SCRIPTS[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Running $script"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if /scripts/"$script"; then
    green "✓ $script passed"
  else
    red "✗ $script failed"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILED" -eq 0 ]; then
  green "All verification scripts passed."
else
  red "$FAILED script(s) failed."
  exit 1
fi
