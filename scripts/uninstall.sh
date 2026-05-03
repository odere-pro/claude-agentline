#!/usr/bin/env bash
# scripts/uninstall.sh — skeleton; body lands in T2 PR 20.
# Spec: §10
#
# Idempotent. Will:
#   1. `npm uninstall -g @agentline/cli` (skipped if absent)
#   2. remove config files copied by install.sh, but preserve user-edited
#      content (detected via SHA mismatch with the shipped template).
#      Only removes the user config when --purge is passed.
#   3. remove the `statusLine` entry from Claude Code settings only when
#      it still points at agentline.
# Refuses to delete unrelated files. No `rm -rf "$VAR"` without guards
# (al_safe_rm enforces).

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup

DRY_RUN=0
PURGE=0

usage() {
  cat <<'EOF'
agentline uninstall — remove agentline from this host.

Usage:
  scripts/uninstall.sh [--dry-run] [--purge]

Options:
  --dry-run     Print the actions that would be taken; touch nothing.
  --purge       Also remove user-edited config files.
  -h, --help    Show this help.

Idempotent. Preserves user-authored content unless --purge is passed.
Honours $CLAUDE_CONFIG_DIR.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --purge) PURGE=1 ;;
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

al_log_info "platform: $(al_detect_os)"
al_log_info "config dir: $(al_config_dir)"
al_log_info "claude settings target: $(al_claude_settings)"

if [ "${DRY_RUN}" = "1" ]; then
  al_log_info "dry-run: would uninstall global package and tidy config dir"
fi
if [ "${PURGE}" = "1" ]; then
  al_log_info "purge: user-edited config files will be removed"
fi

# Body intentionally stubbed until T2 PR 20 lands the uninstall logic.
al_log_info "uninstall skeleton: no-op (body lands in T2 PR 20)"
exit 0
