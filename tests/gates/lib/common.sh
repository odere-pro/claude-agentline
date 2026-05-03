#!/usr/bin/env bash
# tests/gates/lib/common.sh
# Shared helpers for the gates orchestrator and individual gate scripts.
# Bash 3.2 compatible (macOS default). No associative arrays, no `mapfile`,
# no `[[ -v VAR ]]`.
#
# Exit contract honoured by every gate that sources this file:
#   0 = pass
#   1 = fail
#   2 = skipped (gate not applicable on this OS, or required tool absent)

# Guard against re-sourcing. `return` works when the file is sourced; the
# `exit` fallback handles the (unsupported) case of running the lib directly.
if [ -n "${AGENTLINE_GATES_LIB_LOADED:-}" ]; then
  # shellcheck disable=SC2317
  { return 0 2>/dev/null || exit 0; }
fi
AGENTLINE_GATES_LIB_LOADED=1

set -Eeuo pipefail

# Repository root resolved from this file's location: lib/common.sh -> tests/gates/lib -> tests/gates -> tests -> repo.
__GATES_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATES_DIR="$(cd "${__GATES_LIB_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${GATES_DIR}/../.." && pwd)"
GATES_TMP_DIR="${GATES_DIR}/.tmp"
mkdir -p "${GATES_TMP_DIR}"

# Colour output only when stdout is a TTY and NO_COLOR is unset.
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  __C_RESET=$'\033[0m'
  __C_RED=$'\033[31m'
  __C_GREEN=$'\033[32m'
  __C_YELLOW=$'\033[33m'
  __C_DIM=$'\033[2m'
else
  __C_RESET=""
  __C_RED=""
  __C_GREEN=""
  __C_YELLOW=""
  __C_DIM=""
fi

# Internal log writer. Stream argument is the second positional.
__gates_log() {
  printf '%s%s%s %s\n' "$1" "$2" "${__C_RESET}" "$3" >&"$4"
}

log_info() { __gates_log "${__C_DIM}" "[info]" "$*" 2; }
log_pass() { __gates_log "${__C_GREEN}" "[pass]" "$*" 1; }
log_skip() { __gates_log "${__C_YELLOW}" "[skip]" "$*" 1; }
log_fail() { __gates_log "${__C_RED}" "[fail]" "$*" 2; }

# Detect whether a command is available on PATH.
have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# Echo the absolute path of the gate currently executing. Convenience for
# error messages — relies on $0 being set by the calling gate script.
gate_self_id() {
  basename "${0%.sh}"
}

# Skip the current gate with a structured message.
skip_gate() {
  log_skip "$(gate_self_id): $*"
  exit 2
}

# Fail the current gate with a structured message.
fail_gate() {
  log_fail "$(gate_self_id): $*"
  exit 1
}

# Pass the current gate with a structured message.
pass_gate() {
  log_pass "$(gate_self_id): $*"
  exit 0
}

# Resolve a path relative to the repo root.
repo_path() {
  printf '%s/%s' "${REPO_ROOT}" "$1"
}

# Print the list of "shipped artefact" paths that exist in the working tree.
# These are the paths gate 02 scans for forbidden literals. Test fixtures,
# planning docs, repo metadata (CLAUDE.md, CONTRIBUTING.md), the .git
# directory, and the per-developer scratch (`tmp/`) are deliberately excluded
# because they do not enter the published tarball.
shipped_artefact_paths() {
  __gates_emit_if_present \
    scripts \
    src \
    dist \
    schemas \
    templates \
    themes \
    package.json \
    package-lock.json \
    LICENSE \
    README.md \
    CHANGELOG.md \
    CODE_OF_CONDUCT.md \
    SECURITY.md \
    SUPPORT.md
}

__gates_emit_if_present() {
  for __p in "$@"; do
    if [ -e "${REPO_ROOT}/${__p}" ]; then
      printf '%s\n' "${REPO_ROOT}/${__p}"
    fi
  done
}

# Find every executable shell script (`*.sh`) under the supplied roots.
# Sorted output. Empty when no roots exist.
find_shell_scripts() {
  __existing=""
  for __root in "$@"; do
    if [ -e "${REPO_ROOT}/${__root}" ]; then
      __existing="${__existing} ${REPO_ROOT}/${__root}"
    fi
  done
  if [ -z "${__existing}" ]; then
    return 0
  fi
  # shellcheck disable=SC2086
  find ${__existing} -type f -name '*.sh' 2>/dev/null | LC_ALL=C sort
}
