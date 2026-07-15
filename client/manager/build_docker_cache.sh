#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_IMAGE="${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-manager-cache:latest"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

docker buildx build --platform linux/amd64 \
  -f "$SCRIPT_DIR/DockerfileCache" \
  --build-arg "NPM_REGISTRY=$NPM_REGISTRY" \
  -t "$CACHE_IMAGE" \
  --load \
  "$SCRIPT_DIR"

docker push "$CACHE_IMAGE"
