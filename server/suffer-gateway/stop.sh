#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then exec sudo bash "$0" "$@"; fi
command -v systemctl >/dev/null || { echo 'Linux with systemd is required.' >&2; exit 1; }
systemctl stop suffer-gateway.service
if systemctl is-active --quiet suffer-gateway.service; then
  echo 'suffer-gateway is still active.' >&2
  exit 1
fi
echo 'suffer-gateway stopped (boot enablement is unchanged).'
