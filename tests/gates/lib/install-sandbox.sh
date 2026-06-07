#!/usr/bin/env bash
# tests/gates/lib/install-sandbox.sh
# Shared sandbox + snapshot helpers for the install/uninstall gates
# (gate-07 .. gate-10). Sourced after lib/common.sh so REPO_ROOT and the
# log_* helpers are already in scope.
#
# Mirrors tests/integration/install.test.ts: a hermetic sandbox with a
# temp HOME + CLAUDE_CONFIG_DIR + a fake `agentline` shim on PATH so
# scripts/install.sh skips the `npm install -g` step (no network). The
# scripts run for real against the sandbox.
#
# Bash 3.2 compatible (macOS default). No associative arrays, no GNU-only
# flags. POSIX-friendly so the gate passes on macOS + Linux.

if [ -n "${AGENTLINE_GATES_INSTALL_SANDBOX_LIB_LOADED:-}" ]; then
  # shellcheck disable=SC2317
  { return 0 2>/dev/null || exit 0; }
fi
AGENTLINE_GATES_INSTALL_SANDBOX_LIB_LOADED=1

INSTALL_SH="${REPO_ROOT}/scripts/install.sh"
UNINSTALL_SH="${REPO_ROOT}/scripts/uninstall.sh"

# Skip the gate when the install scripts or node are not available.
install_gate_preflight() {
  if [ ! -f "${INSTALL_SH}" ] || [ ! -f "${UNINSTALL_SH}" ]; then
    skip_gate "scripts/install.sh or uninstall.sh not present"
  fi
  if ! have_cmd node; then
    skip_gate "node not available on PATH"
  fi
  if ! have_cmd bash; then
    skip_gate "bash not available on PATH"
  fi
}

# Build a fresh sandbox rooted at "$1". Creates home/, cfg/, bin/ + the
# `agentline` shim, and exports HOME / CLAUDE_CONFIG_DIR / PATH / npm_*
# into the variables the run_* helpers read. Call once per gate.
#
# Sets globals: SANDBOX_ROOT, SANDBOX_HOME, SANDBOX_CFG, SANDBOX_BIN,
#               SANDBOX_NPM_CACHE.
make_install_sandbox() {
  SANDBOX_ROOT="$1"
  rm -rf "${SANDBOX_ROOT}"
  SANDBOX_HOME="${SANDBOX_ROOT}/home"
  SANDBOX_CFG="${SANDBOX_ROOT}/cfg"
  SANDBOX_BIN="${SANDBOX_ROOT}/bin"
  # npm cache kept OUTSIDE the snapshot root so npm debug logs never
  # pollute the tree/hash snapshots (matches the integration suite).
  SANDBOX_NPM_CACHE="${SANDBOX_ROOT}-npmc"
  rm -rf "${SANDBOX_NPM_CACHE}"
  mkdir -p "${SANDBOX_HOME}" "${SANDBOX_CFG}" "${SANDBOX_BIN}" "${SANDBOX_NPM_CACHE}"
  # Fake `agentline` so install.sh's `command -v agentline` succeeds and
  # the global npm-install step is skipped — keeps the gate offline.
  printf '#!/usr/bin/env bash\nexit 0\n' >"${SANDBOX_BIN}/agentline"
  chmod 0755 "${SANDBOX_BIN}/agentline"
}

# Run scripts/install.sh inside the current sandbox with the given args.
# Captures combined output to "${2:-/dev/null}". Returns the script's rc.
run_install() {
  __args_done=0
  __out="${1:-/dev/null}"
  shift || true
  __args_done=1
  set +e
  HOME="${SANDBOX_HOME}" \
  CLAUDE_CONFIG_DIR="${SANDBOX_CFG}" \
  PATH="${SANDBOX_BIN}:${PATH}" \
  npm_config_cache="${SANDBOX_NPM_CACHE}" \
  npm_config_update_notifier=false \
    bash "${INSTALL_SH}" "$@" >"${__out}" 2>&1
  __rc=$?
  set -e
  return ${__rc}
}

# Run scripts/uninstall.sh inside the current sandbox with the given args.
run_uninstall() {
  __out="${1:-/dev/null}"
  shift || true
  set +e
  HOME="${SANDBOX_HOME}" \
  CLAUDE_CONFIG_DIR="${SANDBOX_CFG}" \
  PATH="${SANDBOX_BIN}:${PATH}" \
  npm_config_cache="${SANDBOX_NPM_CACHE}" \
  npm_config_update_notifier=false \
    bash "${UNINSTALL_SH}" "$@" >"${__out}" 2>&1
  __rc=$?
  set -e
  return ${__rc}
}

# Path to the host settings file inside the sandbox.
sandbox_settings_file() {
  printf '%s/.claude/settings.json' "${SANDBOX_HOME}"
}

# sha256 of a file, portable across macOS/Linux. Empty string when absent.
sandbox_sha() {
  if [ ! -f "$1" ]; then
    printf ''
    return 0
  fi
  if have_cmd shasum; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif have_cmd sha256sum; then
    sha256sum "$1" | awk '{print $1}'
  else
    AL_SHA_FILE="$1" node -e 'const fs=require("node:fs"),c=require("node:crypto");process.stdout.write(c.createHash("sha256").update(fs.readFileSync(process.env.AL_SHA_FILE)).digest("hex"))'
  fi
}

# Deterministic "path\tsha256" snapshot of every file under "$1", sorted.
# Captures both the tree shape AND content, so a same-tree content change
# is caught. Empty when the root is absent.
snapshot_tree_with_hashes() {
  __root="$1"
  [ -d "${__root}" ] || return 0
  # find -type f is POSIX; LC_ALL=C sort is stable across locales.
  find "${__root}" -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r __f; do
    __rel="${__f#"${__root}"/}"
    printf '%s\t%s\n' "${__rel}" "$(sandbox_sha "${__f}")"
  done
}

# Extract a single top-level JSON key's value from a file as compact JSON,
# via node. Prints empty when the file or key is absent. Used to compare
# non-statusLine keys for content preservation.
sandbox_json_key() {
  AL_JSON_FILE="$1" AL_JSON_KEY="$2" node -e '
    const fs=require("node:fs");
    let o={};
    try { o=JSON.parse(fs.readFileSync(process.env.AL_JSON_FILE,"utf8")); } catch { process.exit(0); }
    const v=o[process.env.AL_JSON_KEY];
    if (v===undefined) process.exit(0);
    process.stdout.write(JSON.stringify(v));
  ' 2>/dev/null
}
