#!/usr/bin/env bash
set -euo pipefail

IGNORE="typescript,vitest,@types/*,tsx,supertest,@asteasolutions/zod-to-openapi,prom-client,swagger-ui-express,express"
EXIT_CODE=0

for dir in packages/*/  services/*/; do
  if [ ! -f "$dir/package.json" ]; then
    continue
  fi
  echo "--- Checking $dir ---"
  if ! npx depcheck "$dir" --ignores="$IGNORE"; then
    EXIT_CODE=1
  fi
done

exit $EXIT_CODE
