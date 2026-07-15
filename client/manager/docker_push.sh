#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_REGISTRY:?DOCKER_REGISTRY is required}"

docker push "${DOCKER_REGISTRY}/ak_rg/phoenix-suffer-manager:latest"
