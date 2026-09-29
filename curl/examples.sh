#!/usr/bin/env bash
# Every ELECTE Platform API v1 route as a curl call.
#
#   export ELECTE_API_KEY=...                 # created in the platform's API keys panel
#   ./examples.sh me
#   ./examples.sh workspaces
#   ./examples.sh workspace <workspaceId>
#   ./examples.sh data-sources|reports|usage|webhooks <workspaceId>
#   ./examples.sh report <reportId>
#   ./examples.sh report-status <reportId>
#   ./examples.sh all <workspaceId>           # everything above for one workspace
#
# Prints the status line, the rate-limit headers and the body (pretty-printed when
# python3 is available). Errors are RFC 9457 problem documents.
set -euo pipefail

: "${ELECTE_API_KEY:?Set ELECTE_API_KEY - create a key in the API keys panel at https://platform.electe.net}"
BASE="${ELECTE_API_BASE:-https://api.electe.net}"

call() {
  local path="$1"
  local headers body
  headers="$(mktemp)"
  echo "GET $path"
  body="$(curl -sS -D "$headers" -H "Authorization: Bearer $ELECTE_API_KEY" -H 'Accept: application/json' "$BASE$path")"
  awk 'NR==1 || tolower($0) ~ /^(x-ratelimit|retry-after|content-type)/ { printf "  %s\n", $0 }' "$headers" | tr -d '\r'
  if command -v python3 >/dev/null; then
    printf '%s' "$body" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$body"
  else
    printf '%s\n' "$body"
  fi
  echo
  rm -f "$headers"
}

need_id() { [ -n "${2:-}" ] || { echo "usage: $0 $1 <id>" >&2; exit 2; }; }

case "${1:-}" in
  me)            call /v1/me ;;
  workspaces)    call "/v1/workspaces?limit=${LIMIT:-25}&offset=${OFFSET:-0}" ;;
  workspace)     need_id "$@"; call "/v1/workspaces/$2" ;;
  data-sources)  need_id "$@"; call "/v1/workspaces/$2/data-sources" ;;
  reports)       need_id "$@"; call "/v1/workspaces/$2/reports" ;;
  usage)         need_id "$@"; call "/v1/workspaces/$2/usage" ;;
  webhooks)      need_id "$@"; call "/v1/workspaces/$2/webhooks" ;;
  report)        need_id "$@"; call "/v1/reports/$2" ;;
  report-status) need_id "$@"; call "/v1/reports/$2/status" ;;
  all)
    need_id "$@"
    call /v1/me
    call /v1/workspaces
    for sub in "" /data-sources /reports /usage /webhooks; do call "/v1/workspaces/$2$sub"; done
    ;;
  *)
    sed -n '2,14p' "$0"; exit 2 ;;
esac
