#!/usr/bin/env bash
# scripts/init.sh — skeleton; body lands in T2 PR 17.
# Spec: §10
#
# Idempotent. Bootstraps `${CLAUDE_PROJECT_DIR}/.agentline.json` from
# templates/minimal.config.json. Pure filesystem; no network. Running this
# script twice MUST yield no diff (gate 04 enforces).

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup

DRY_RUN=0

usage() {
  cat <<'EOF'
agentline init — seed `.agentline.json` in the current project.

Usage:
  scripts/init.sh [--dry-run]

Options:
  --dry-run     Print the actions that would be taken; touch nothing.
  -h, --help    Show this help.

Honours $CLAUDE_PROJECT_DIR; defaults to the current working directory.
Idempotent: re-running on a project that already has `.agentline.json`
leaves the file untouched.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
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

project_dir="${CLAUDE_PROJECT_DIR:-${PWD}}"
target="${project_dir}/.agentline.json"
template_rel="templates/minimal.config.json"
template_abs="$(cd "${THIS_DIR}/.." && pwd)/${template_rel}"

al_log_info "project dir: ${project_dir}"
al_log_info "target: ${target}"

if [ -f "${target}" ]; then
  al_log_info "already initialised; leaving ${target} untouched"
  exit 0
fi

if [ ! -f "${template_abs}" ]; then
  # Skeleton is allowed to no-op when the template has not been added yet
  # (T2 PR 19 ships templates/). The init contract — "no diff on second
  # run" — still holds: nothing was created, so a re-run is also a no-op.
  al_log_info "template not present yet (${template_rel}); skipping seed"
  exit 0
fi

if [ "${DRY_RUN}" = "1" ]; then
  al_log_info "dry-run: would copy ${template_rel} -> ${target}"
  exit 0
fi

# Body intentionally stubbed until T2 PR 17 fills it. The real
# implementation will copy via write-temp + rename for atomicity (§4.9).
al_log_info "init skeleton: no-op (body lands in T2 PR 17)"
exit 0
