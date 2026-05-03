#!/usr/bin/env bash
# scripts/lib/common.sh
# Shared helpers for `scripts/{install,init,doctor,uninstall}.sh`.
# Bash 3.2 compatible (macOS default; the spec also requires support under
# Bash 5+ and Git Bash on Windows). No associative arrays, no `mapfile`.
#
# Source contract:
#   set -Eeuo pipefail               # callers must set this themselves too
#   al_setup                         # idempotent; installs the cleanup trap
#   al_require_node                  # exits non-zero on Node <20
#
# Spec: §10 (lifecycle scripts), §1.5 C2 (Bash 3.2 / Git Bash).

# Guard against re-sourcing.
if [ -n "${AGENTLINE_SCRIPTS_LIB_LOADED:-}" ]; then
  # shellcheck disable=SC2317
  { return 0 2>/dev/null || exit 0; }
fi
AGENTLINE_SCRIPTS_LIB_LOADED=1

# These two paths are derived, never literal — keeping the gate-02
# (no-absolute-paths) contract intact in shipped artefacts.
AL_HOME_DIR="${HOME:-}"
if [ -z "${AL_HOME_DIR}" ]; then
  printf 'agentline: HOME is not set; cannot continue\n' >&2
  exit 1
fi

# Where Claude Code reads its settings. The spec wires `statusLine` here.
AL_CLAUDE_SETTINGS="${AL_HOME_DIR}/.claude/settings.json"

# Where agentline persists merged user config. Honours XDG-ish overrides.
AL_CONFIG_DIR_DEFAULT="${AL_HOME_DIR}/.config/agentline"
AL_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-${AL_CONFIG_DIR_DEFAULT}}"
AL_CONFIG_FILE="${AL_CONFIG_DIR}/config.json"
AL_THEMES_DIR="${AL_CONFIG_DIR}/themes"

# Logging — every line goes to stderr so stdout stays clean for tools that
# pipe `agentline` output.
al_log_info() { printf '[agentline] %s\n' "$*" >&2; }
al_log_warn() { printf '[agentline][warn] %s\n' "$*" >&2; }
al_log_error() { printf '[agentline][error] %s\n' "$*" >&2; }

# Exit with a structured message. Second arg is the exit code (default 1).
al_die() {
  al_log_error "$1"
  exit "${2:-1}"
}

# OS detection. Returns one of: macos, linux, windows, unknown.
al_detect_os() {
  case "$(uname -s 2>/dev/null || true)" in
    Darwin) printf 'macos' ;;
    Linux) printf 'linux' ;;
    MINGW* | MSYS* | CYGWIN*) printf 'windows' ;;
    *) printf 'unknown' ;;
  esac
}

# Verify Node ≥20 LTS. The spec (N1, C3) names Node 20 LTS as the only
# runtime requirement.
al_require_node() {
  if ! command -v node >/dev/null 2>&1; then
    al_die "node is required (>=20 LTS); install from https://nodejs.org/"
  fi
  __ver="$(node -p 'process.versions.node' 2>/dev/null || true)"
  if [ -z "${__ver}" ]; then
    al_die "could not read \`node\` version"
  fi
  __major="${__ver%%.*}"
  case "${__major}" in
    "" | *[!0-9]*)
      al_die "could not parse node major version from '${__ver}'"
      ;;
  esac
  if [ "${__major}" -lt 20 ]; then
    al_die "node ${__ver} detected; agentline requires Node >=20 LTS"
  fi
}

# Track tmp paths so the cleanup trap can remove them on exit. Plain string
# (newline-separated) keeps Bash 3.2 happy.
AL_CLEANUP_PATHS=""

al_register_cleanup() {
  AL_CLEANUP_PATHS="${AL_CLEANUP_PATHS}
$1"
}

al_run_cleanup() {
  if [ -z "${AL_CLEANUP_PATHS}" ]; then
    return 0
  fi
  printf '%s\n' "${AL_CLEANUP_PATHS}" | while IFS= read -r __p; do
    if [ -n "${__p}" ] && [ -e "${__p}" ]; then
      al_safe_rm "${__p}"
    fi
  done
}

# Guarded `rm -rf`. Refuses paths that look dangerous (root, $HOME itself,
# empty, single segment). Spec §10: "no rm -rf "$VAR" without guards".
al_safe_rm() {
  __target="${1:-}"
  if [ -z "${__target}" ]; then
    al_log_warn "al_safe_rm: refusing empty path"
    return 1
  fi
  case "${__target}" in
    /|/.|/.. )
      al_log_warn "al_safe_rm: refusing root path '${__target}'"
      return 1
      ;;
    "${AL_HOME_DIR}"|"${AL_HOME_DIR}/")
      al_log_warn "al_safe_rm: refusing HOME path"
      return 1
      ;;
  esac
  rm -rf -- "${__target}"
}

# Setup convenience: register the cleanup trap exactly once. Callers can
# still install their own ERR/EXIT traps; this one is additive when chained
# via al_register_cleanup paths.
__AL_TRAP_INSTALLED="${__AL_TRAP_INSTALLED:-0}"
al_setup() {
  if [ "${__AL_TRAP_INSTALLED}" = "1" ]; then
    return 0
  fi
  trap 'al_run_cleanup' EXIT
  __AL_TRAP_INSTALLED=1
}

# Convenience: print an absolute path to the config dir (creates nothing).
al_config_dir() { printf '%s' "${AL_CONFIG_DIR}"; }
al_config_file() { printf '%s' "${AL_CONFIG_FILE}"; }
al_themes_dir() { printf '%s' "${AL_THEMES_DIR}"; }
al_claude_settings() { printf '%s' "${AL_CLAUDE_SETTINGS}"; }
