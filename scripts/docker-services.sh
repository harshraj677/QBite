#!/usr/bin/env bash
# QBite — start/stop local infrastructure dependencies (MongoDB, Redis)
# via Docker Compose, without touching the (still-placeholder)
# backend/admin service definitions. Usage:
#   scripts/docker-services.sh up
#   scripts/docker-services.sh down
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ACTION="${1:-up}"

case "$ACTION" in
  up)
    docker compose up -d mongo redis
    ;;
  down)
    docker compose down
    ;;
  *)
    echo "Usage: $0 [up|down]" >&2
    exit 1
    ;;
esac
