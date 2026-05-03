#!/usr/bin/env bash
# scripts/doctor.sh — skeleton; body lands in T2 PR 11.
# Spec: §9.2, §10
#
# Read-only wrapper over `agentline doctor`. Inspects host prerequisites,
# the wired settings entry, the merged config, and Nerd Font availability.
# This skeleton runs the prerequisite check (Node >=20) and exits 0 so
# gate-01 passes from the moment it lands; richer checks arrive with the
# binary itself.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup

FIX=0

usage() {
  cat <<'EOF'
agentline doctor — diagnose the host's agentline integration.

Usage:
  scripts/doctor.sh [--fix]

Options:
  --fix         Repair documented misconfigurations (delegated to the bin).
  -h, --help    Show this help.

Read-only by default. Exits 0 on a healthy host, 1 otherwise.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --fix) FIX=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      al_log_error "unknown option: $1"
      usage >&2
      exit 1
      ;;
  esac
  shift
done

al_require_node
al_log_info "platform: $(al_detect_os)"
al_log_info "config dir: $(al_config_dir)"

# Prefer the installed bin when available; fall back to the skeleton's own
# yes/no so this script remains useful before the package is published.
if command -v agentline >/dev/null 2>&1; then
  if [ "${FIX}" = "1" ]; then
    exec agentline doctor --fix
  else
    exec agentline doctor
  fi
fi

al_log_info "agentline bin not yet on PATH; running skeleton checks only"
al_log_info "doctor skeleton: host prerequisites OK (body lands in T2 PR 11)"
exit 0
