#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker buildx build --no-cache --platform linux/amd64 \
  -f "$SCRIPT_DIR/Dockerfile" \
  -t "${DOCKER_REGISTRY}/ak_rg/web-api:latest" \
  --load \
  "$SCRIPT_DIR/../.."
