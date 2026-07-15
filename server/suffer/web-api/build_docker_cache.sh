#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_IMAGE="${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-web-api-cache:latest"

docker buildx build --platform linux/amd64 \
  -f "$SCRIPT_DIR/DockerfileCache" \
  -t "$CACHE_IMAGE" \
  --load \
  "$SCRIPT_DIR/../.."

docker push "$CACHE_IMAGE"
