#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

docker buildx build --platform linux/amd64 \
  --build-arg "BASE_IMAGE=${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-manager-cache:latest" \
  --build-arg "NPM_REGISTRY=$NPM_REGISTRY" \
  --build-arg "APP_BASE_PATH=${APP_BASE_PATH:-/suffer-web}" \
  -t "${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-manager:latest" \
  --load \
  "$SCRIPT_DIR"
