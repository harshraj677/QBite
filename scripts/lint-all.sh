#!/usr/bin/env bash
# QBite — run lint/analyze across every app. Intended as the local
# equivalent of what CI will run once workflows are added (see
# .github/workflows).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Backend: eslint"
npm run backend:lint

echo "==> Admin: eslint"
npm run admin:lint

echo "==> Mobile: flutter analyze"
(cd apps/mobile && flutter analyze)

echo "==> All lint checks passed."
