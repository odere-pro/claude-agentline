#!/usr/bin/env bash
# scripts/install.sh — skeleton; body lands in T2 PR 17/20.
# Spec: §10
#
# Idempotent. Verifies Node >=20. Will:
#   1. install or link `@agentline/cli` (npm i -g, or `npm link` with --from-source)
#   2. seed the user config from templates/default.config.json (no overwrite)
#   3. seed themes/ to the same config dir
#   4. wire `statusLine` into Claude Code's settings file when unset
# All filesystem writes go through atomic write-temp + rename.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup

DRY_RUN=0
FORCE=0
FROM_SOURCE=0

usage() {
  cat <<'EOF'
agentline install — wires @agentline/cli into Claude Code's statusline.

Usage:
  scripts/install.sh [--dry-run] [--force] [--from-source]

Options:
  --dry-run       Print the actions that would be taken; touch nothing.
  --force         Overwrite an existing statusLine value if it does not
                  already point at agentline.
  --from-source   `npm link` from the current checkout instead of installing
                  the published tarball. Intended for repo contributors.
  -h, --help      Show this help.

Exits 0 on success, 1 on unrecoverable error. Honours $CLAUDE_CONFIG_DIR.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    --from-source) FROM_SOURCE=1 ;;
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

os="$(al_detect_os)"
al_log_info "platform: ${os}"
al_log_info "config dir: $(al_config_dir)"
al_log_info "claude settings target: $(al_claude_settings)"

if [ "${DRY_RUN}" = "1" ]; then
  al_log_info "dry-run: would seed config, themes, and wire statusLine"
fi
if [ "${FORCE}" = "1" ]; then
  al_log_info "force: existing non-agentline statusLine values will be overwritten"
fi
if [ "${FROM_SOURCE}" = "1" ]; then
  al_log_info "from-source: will \`npm link\` from this checkout"
fi

# Body intentionally stubbed until T2 PR 17/20 lands the install logic.
# A bare run of the skeleton must remain a no-op so this PR's gates stay
# green; the gate suite will exercise real behaviour once the body arrives.
al_log_info "install skeleton: no-op (body lands in T2 PR 17/20)"
exit 0
