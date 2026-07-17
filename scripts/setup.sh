#!/usr/bin/env bash
# QBite — one-shot dev environment bootstrap.
# Installs JS/TS workspace dependencies (backend, admin, packages) and
# resolves Flutter dependencies for the mobile app.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Installing JS/TS workspace dependencies (backend, admin, packages)"
npm install

echo "==> Resolving Flutter dependencies (apps/mobile)"
(cd apps/mobile && flutter pub get)

echo "==> Done. Copy each app's .env.example to a real env file before running:"
echo "    apps/backend/.env.example -> apps/backend/.env"
echo "    apps/admin/.env.example   -> apps/admin/.env.local"
echo "    apps/mobile/.env.example  -> apps/mobile/.env.development (and .env.staging / .env.production as needed)"
