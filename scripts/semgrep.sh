#!/usr/bin/env bash
set -euo pipefail

CONFIGS="--config auto --config p/nodejs --config p/typescript"

if command -v semgrep &>/dev/null; then
  semgrep $CONFIGS .
else
  docker run --rm -v "$(pwd):/src" semgrep/semgrep semgrep $CONFIGS /src
fi
