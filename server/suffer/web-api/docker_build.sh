#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"

docker buildx build --platform linux/amd64 \
  -f "$SCRIPT_DIR/Dockerfile" \
  --build-arg "BASE_IMAGE=${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-web-api-cache:latest" \
  --build-arg "GOPROXY=$GOPROXY" \
  -t "${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-web-api:latest" \
  --load \
  "$SCRIPT_DIR/../.."
