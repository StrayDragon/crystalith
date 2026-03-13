#!/usr/bin/env bash
# Wait for TCP ports or HTTP endpoints to become ready.
#
# Usage:
#   scripts/wait_ready.sh tcp <host> <port> [timeout_s=120]
#   scripts/wait_ready.sh http <url> [timeout_s=120]
#   scripts/wait_ready.sh searxng <port> [timeout_s=60]
#       Wait for SearXNG to respond with 200 or 400 on the search endpoint.
set -euo pipefail

MODE="${1:?Usage: wait_ready.sh <tcp|http|searxng> ...}"
shift

wait_tcp() {
  local host="$1" port="$2" timeout_s="${3:-120}"
  local start
  start="$(date +%s)"
  while true; do
    if python -c 'import socket,sys; s=socket.socket(); s.settimeout(1.0); s.connect((sys.argv[1],int(sys.argv[2]))); s.close()' \
      "$host" "$port" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - start >= timeout_s )); then
      echo "timeout waiting for tcp ${host}:${port}" >&2
      return 1
    fi
    sleep 1
  done
}

wait_http() {
  local url="$1" timeout_s="${2:-120}"
  local start
  start="$(date +%s)"
  while true; do
    if python -c 'import sys,urllib.request; urllib.request.urlopen(sys.argv[1],timeout=2).read()' \
      "$url" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - start >= timeout_s )); then
      echo "timeout waiting for http ${url}" >&2
      return 1
    fi
    sleep 1
  done
}

wait_searxng() {
  local port="$1" timeout_s="${2:-60}"
  local url="http://127.0.0.1:${port}/search?q=&format=json"
  local start
  start="$(date +%s)"
  while true; do
    local status
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)"
    if [[ "$status" == "200" || "$status" == "400" ]]; then
      return 0
    fi
    if (( "$(date +%s)" - start >= timeout_s )); then
      echo "timeout waiting for http ${url}" >&2
      return 1
    fi
    sleep 1
  done
}

case "$MODE" in
  tcp)     wait_tcp "$@" ;;
  http)    wait_http "$@" ;;
  searxng) wait_searxng "$@" ;;
  *)       echo "Unknown mode: $MODE" >&2; exit 1 ;;
esac
