#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker buildx build --no-cache --platform linux/amd64 \
  --build-arg "SERVER_TARGET=${SERVER_TARGET:-}" \
  --build-arg "APP_URL_PREFIX=${APP_URL_PREFIX:-/api}" \
  --build-arg "JWT_SECRET=${JWT_SECRET:-next-admin}" \
  -t "${DOCKER_REGISTRY}/ak_rg/manager:latest" \
  --load \
  "$SCRIPT_DIR"
