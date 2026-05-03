#!/usr/bin/env bash
# scripts/doctor.sh — read-only wrapper over `agentline doctor`.
#
# Resolves the bin in this priority order:
#   1. an explicit AGENTLINE_BIN env var (used by tests / gates),
#   2. the local build at <repo>/dist/cli.mjs,
#   3. an `agentline` on PATH (global install),
#   4. `npx -y @agentline/cli` as the last fallback.
#
# Forwards every argument unchanged. Never mutates host state — to
# repair, invoke `agentline doctor --fix` directly.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"
al_setup
al_require_node

repo_root="$(cd "${THIS_DIR}/.." && pwd)"

run_doctor() {
  if [ -n "${AGENTLINE_BIN:-}" ] && [ -x "${AGENTLINE_BIN}" ]; then
    "${AGENTLINE_BIN}" doctor "$@"
    return
  fi

  local_bin="${repo_root}/dist/cli.mjs"
  if [ -f "${local_bin}" ]; then
    node "${local_bin}" doctor "$@"
    return
  fi

  if command -v agentline >/dev/null 2>&1; then
    agentline doctor "$@"
    return
  fi

  if command -v npx >/dev/null 2>&1; then
    npx -y @agentline/cli doctor "$@"
    return
  fi

  al_die "no agentline bin available (build the repo with \`npm run build\` or install \`@agentline/cli\` globally)" 2
}

run_doctor "$@"
