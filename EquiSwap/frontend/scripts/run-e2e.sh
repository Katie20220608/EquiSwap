#!/usr/bin/env bash
# Runs the Playwright E2E suites locally.
# Usage: scripts/run-e2e.sh [mocked|integration|all]   (default: all)
set -euo pipefail

cd "$(dirname "$0")/.."
suite="${1:-all}"

[ -d node_modules ] || npm ci
npx playwright install chromium

case "$suite" in
  mocked) npm run test:e2e ;;
  integration) npm run test:e2e:integration ;;
  all) npm run test:e2e && npm run test:e2e:integration ;;
  *) echo "Unknown suite '$suite' (use mocked, integration or all)" >&2; exit 1 ;;
esac
