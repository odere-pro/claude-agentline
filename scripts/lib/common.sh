#!/usr/bin/env bash
# scripts/lib/common.sh
# Shared helpers for `scripts/{install,doctor,uninstall}.sh`.
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
# Where the host runtime loads agent/skill markdown files at startup.
AL_AGENTS_DIR="${AL_HOME_DIR}/.claude/agents"

# Where agentline persists merged user config. Honours XDG-ish overrides.
AL_CONFIG_DIR_DEFAULT="${AL_HOME_DIR}/.config/agentline"
AL_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-${AL_CONFIG_DIR_DEFAULT}}"

# Validate `CLAUDE_CONFIG_DIR` before any installer step writes through it.
# A blank or relative value would resolve against the cwd — `install.sh`
# called from /tmp would silently write `tmp/themes/`, `tmp/state/...`. A
# path with `..` segments could escape the user's profile entirely. A path
# rooted under a system directory (`/etc`, `/usr`, `/var`) is almost
# certainly a mistake or hostile environment; refuse rather than risk a
# privileged write when the installer is run as root.
case "${AL_CONFIG_DIR}" in
  "")
    printf 'agentline: CLAUDE_CONFIG_DIR is empty; refusing to derive paths from it\n' >&2
    exit 1
    ;;
  /*) ;;
  # Windows drive-letter paths (`D:\…` or `D:/…`) under Git Bash: still
  # absolute, just with a drive root. Accept both slash flavours.
  [A-Za-z]:[/\\]*) ;;
  *)
    printf 'agentline: CLAUDE_CONFIG_DIR must be an absolute path (got: %s)\n' "${AL_CONFIG_DIR}" >&2
    exit 1
    ;;
esac
case "${AL_CONFIG_DIR}" in
  */../* | *"/..") # any parent-dir traversal segment
    printf 'agentline: CLAUDE_CONFIG_DIR must not contain traversal segments (got: %s)\n' "${AL_CONFIG_DIR}" >&2
    exit 1
    ;;
esac
# `/var` is not blanket-rejected: macOS resolves `$TMPDIR` to a
# `/private/var/folders/...` path (and `tmpdir()` returns the same), and
# `/var/tmp` is a valid temp root on most Unixes. Reject only the
# directories that contain executables / system config rather than
# user-writable subtrees.
case "${AL_CONFIG_DIR}" in
  /etc | /etc/* | /usr | /usr/* | /bin | /bin/* | /sbin | /sbin/* | /boot | /boot/*)
    printf 'agentline: CLAUDE_CONFIG_DIR points inside a system directory (%s); refusing\n' "${AL_CONFIG_DIR}" >&2
    exit 1
    ;;
esac

AL_CONFIG_FILE="${AL_CONFIG_DIR}/config.json"
AL_THEMES_DIR="${AL_CONFIG_DIR}/themes"
# Pre-install snapshot of the user's `statusLine`. Written by install (so
# the prior value survives an overwrite) and read by uninstall (so the
# host returns to its pre-install state). First install wins — re-runs
# never clobber the original.
# shellcheck disable=SC2034 # consumed by sourced install.sh / uninstall.sh
AL_STATE_DIR="${AL_CONFIG_DIR}/state"
# shellcheck disable=SC2034 # consumed by sourced install.sh / uninstall.sh
AL_STATUS_LINE_BACKUP="${AL_STATE_DIR}/settings-backup.json"

# Colour palette — populated by __al_colour_init only when stderr is a TTY and
# the user has not opted out. Every value stays empty in plain mode, so the
# logging helpers below emit byte-for-byte the same text they always have.
AL_USE_COLOR=0
AL_ESC=""
AL_C_RESET=""
AL_C_BRAND=""
AL_C_OK=""
AL_C_WARN=""
AL_C_ERR=""
AL_C_DIM=""
AL_C_SIGN=""
AL_C_ULON=""
AL_C_ULOFF=""
AL_OSC_OPEN=""
AL_OSC_ST_SED=""
AL_SED_D=""

# Decide once whether to style log output. Honours the https://no-color.org
# convention (any non-empty NO_COLOR), a dumb terminal, and a non-TTY stderr
# (all logging goes to fd 2). Mirrors the colour gate in the TS doctor formatter.
__al_colour_init() {
  if [ -n "${NO_COLOR:-}" ]; then return 0; fi
  if [ "${TERM:-}" = "dumb" ]; then return 0; fi
  if [ ! -t 2 ]; then return 0; fi
  AL_ESC="$(printf '\033')"
  AL_USE_COLOR=1
  AL_C_RESET="${AL_ESC}[0m"
  AL_C_BRAND="${AL_ESC}[1;36m" # bold cyan
  AL_C_OK="${AL_ESC}[32m"      # green
  AL_C_WARN="${AL_ESC}[33m"    # yellow
  AL_C_ERR="${AL_ESC}[31m"     # red
  # shellcheck disable=SC2034 # consumed by install.sh print_greeting
  AL_C_DIM="${AL_ESC}[2m" # dim (greeting link labels)
  # shellcheck disable=SC2034 # consumed by install.sh print_greeting
  AL_C_SIGN="${AL_ESC}[1;35m" # bold magenta (greeting sign-off)
  AL_C_ULON="${AL_ESC}[4m"     # underline on
  AL_C_ULOFF="${AL_ESC}[24m"   # underline off (keeps any active colour)
  AL_OSC_OPEN="${AL_ESC}]8;;"  # OSC 8 hyperlink open
  # OSC 8 String Terminator (ESC \) as it must appear inside a sed replacement:
  # the trailing backslash is doubled so sed emits a single literal backslash.
  AL_OSC_ST_SED="${AL_ESC}\\\\"
  # SOH delimiter for the sed below — never appears in a path or URL, so the
  # match text can contain any of /, :, #, &, | without breaking the s command.
  AL_SED_D="$(printf '\001')"
}
__al_colour_init

# Underline + OSC 8 hyperlink every file path and URL in a message so modern
# terminals render them clickable (file:// for paths). No-op unless colour is
# active; the path branch anchors on a leading / or ~/ so it never matches a
# package name like @odere-pro/agentline.
__al_emph() {
  if [ "${AL_USE_COLOR}" != "1" ]; then
    printf '%s' "$1"
    return 0
  fi
  printf '%s' "$1" | sed -E \
    -e "s${AL_SED_D}(https?://[^[:space:]]+)${AL_SED_D}${AL_OSC_OPEN}\1${AL_OSC_ST_SED}${AL_C_ULON}\1${AL_C_ULOFF}${AL_OSC_OPEN}${AL_OSC_ST_SED}${AL_SED_D}g" \
    -e "s${AL_SED_D}(^|[[:space:]])(~?/[^[:space:]]+)${AL_SED_D}\1${AL_OSC_OPEN}file://\2${AL_OSC_ST_SED}${AL_C_ULON}\2${AL_C_ULOFF}${AL_OSC_OPEN}${AL_OSC_ST_SED}${AL_SED_D}g"
}

# Render the `[agentline]` brand prefix (bold cyan when styled, plain otherwise).
__al_brand() {
  if [ "${AL_USE_COLOR}" = "1" ]; then
    printf '%s[agentline]%s' "${AL_C_BRAND}" "${AL_C_RESET}"
  else
    printf '[agentline]'
  fi
}

# Logging — every line goes to stderr so stdout stays clean for tools that
# pipe `agentline` output. Plain-mode output is identical to the historic
# format; colour mode only adds SGR/OSC sequences around the same text.
al_log_info() {
  if [ "${AL_USE_COLOR}" = "1" ]; then
    printf '%s %s\n' "$(__al_brand)" "$(__al_emph "$*")" >&2
  else
    printf '[agentline] %s\n' "$*" >&2
  fi
}

# Success variant — green message, same prefix as al_log_info (so plain output
# is indistinguishable from an info line and call-site swaps are safe).
al_log_ok() {
  if [ "${AL_USE_COLOR}" = "1" ]; then
    printf '%s %s%s%s\n' "$(__al_brand)" "${AL_C_OK}" "$(__al_emph "$*")" "${AL_C_RESET}" >&2
  else
    printf '[agentline] %s\n' "$*" >&2
  fi
}

al_log_warn() {
  if [ "${AL_USE_COLOR}" = "1" ]; then
    printf '%s%s[warn]%s %s%s%s\n' "$(__al_brand)" "${AL_C_WARN}" "${AL_C_RESET}" "${AL_C_WARN}" "$(__al_emph "$*")" "${AL_C_RESET}" >&2
  else
    printf '[agentline][warn] %s\n' "$*" >&2
  fi
}

al_log_error() {
  if [ "${AL_USE_COLOR}" = "1" ]; then
    printf '%s%s[error]%s %s%s%s\n' "$(__al_brand)" "${AL_C_ERR}" "${AL_C_RESET}" "${AL_C_ERR}" "$(__al_emph "$*")" "${AL_C_RESET}" >&2
  else
    printf '[agentline][error] %s\n' "$*" >&2
  fi
}

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
al_agents_dir() { printf '%s' "${AL_AGENTS_DIR}"; }
