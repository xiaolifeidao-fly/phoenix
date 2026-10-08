#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
ARCH="${1:-amd64}"
case "$ARCH" in amd64|arm64) ;; *) echo 'Usage: ./build.sh [amd64|arm64]' >&2; exit 2 ;; esac
command -v go >/dev/null || { echo 'Go 1.21+ is required.' >&2; exit 1; }

go test -timeout 60s ./...
go vet ./...
mkdir -p dist
PACKAGE_NAME="suffer-gateway-linux-$ARCH"
STAGING="$(mktemp -d "$SCRIPT_DIR/dist/.build.XXXXXXXX")"
# Only remove the exact temporary directory created by this script.
trap 'rm -rf -- "$STAGING"' EXIT
mkdir -p "$STAGING/$PACKAGE_NAME"
CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" go build -trimpath -ldflags='-s -w' -o "$STAGING/$PACKAGE_NAME/suffer-gateway" .
cp config.example.json suffer-gateway.service README.md deploy.sh start.sh stop.sh "$STAGING/$PACKAGE_NAME/"
chmod 0755 "$STAGING/$PACKAGE_NAME/"*.sh "$STAGING/$PACKAGE_NAME/suffer-gateway"
COPYFILE_DISABLE=1 tar -czf "$STAGING/$PACKAGE_NAME.tar.gz" -C "$STAGING" "$PACKAGE_NAME"
mv -f "$STAGING/$PACKAGE_NAME.tar.gz" "dist/$PACKAGE_NAME.tar.gz"
echo "Package: $SCRIPT_DIR/dist/$PACKAGE_NAME.tar.gz"
