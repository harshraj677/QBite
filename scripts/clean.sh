#!/usr/bin/env bash
# QBite — remove all build artifacts and dependency caches across the
# monorepo. Safe to run any time; everything it deletes is regenerated
# by `scripts/setup.sh`.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Removing node_modules (root + all workspaces)"
find . -maxdepth 4 -type d -name "node_modules" -prune -exec rm -rf {} +

echo "==> Removing TS build output"
find . -maxdepth 4 -type d \( -name "dist" -o -name ".next" \) -prune -exec rm -rf {} +

echo "==> Cleaning Flutter build artifacts (apps/mobile)"
(cd apps/mobile && flutter clean) || true

echo "==> Done. Run scripts/setup.sh to reinstall."
