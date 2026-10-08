#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then exec sudo bash "$0" "$@"; fi
command -v systemctl >/dev/null || { echo 'Linux with systemd is required.' >&2; exit 1; }
[[ -x /opt/suffer-gateway/suffer-gateway ]] || { echo 'Run deploy.sh first.' >&2; exit 1; }
LISTEN="$(/opt/suffer-gateway/suffer-gateway -config /etc/suffer-gateway/config.json -check-config)"
case "$LISTEN" in
  0.0.0.0:*|:*) HEALTH_ADDRESS="127.0.0.1:${LISTEN##*:}" ;;
  \[::\]:*) HEALTH_ADDRESS="[::1]:${LISTEN##*:}" ;;
  *) HEALTH_ADDRESS="$LISTEN" ;;
esac
command -v curl >/dev/null || { echo 'curl is required for health checks.' >&2; exit 1; }
# start is idempotent; use deploy.sh to restart after an update.
systemctl start suffer-gateway.service
for ((attempt=1; attempt<=20; attempt++)); do
  if systemctl is-active --quiet suffer-gateway.service && curl --noproxy '*' -fsS --max-time 2 "http://$HEALTH_ADDRESS/healthz" >/dev/null; then
    echo "suffer-gateway started: http://$HEALTH_ADDRESS"
    exit 0
  fi
  sleep 1
done
journalctl -u suffer-gateway.service -n 30 --no-pager >&2 || true
echo 'suffer-gateway health check failed.' >&2
exit 1
