#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

docker buildx build --platform linux/amd64 \
  --build-arg "BASE_IMAGE=${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-manager-cache:latest" \
  --build-arg "NPM_REGISTRY=$NPM_REGISTRY" \
  --build-arg "SERVER_TARGET=${SERVER_TARGET:-}" \
  --build-arg "APP_URL_PREFIX=${APP_URL_PREFIX:-/api}" \
  --build-arg "APP_BASE_PATH=${APP_BASE_PATH:-/suffer-web}" \
  --build-arg "JWT_SECRET=${JWT_SECRET:-next-admin}" \
  -t "${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-manager:latest" \
  --load \
  "$SCRIPT_DIR"
