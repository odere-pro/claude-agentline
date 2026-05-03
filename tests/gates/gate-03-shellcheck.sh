#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 03: every `*.sh` under `scripts/` and `tests/` passes `shellcheck -x`.
# Spec: §10, §11.2
# Pass: shellcheck exits 0 against every discovered script.
# Fail: shellcheck reports any diagnostic on any script.
# Skip: shellcheck binary is unavailable on this host.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

if ! have_cmd shellcheck; then
  skip_gate "shellcheck not installed"
fi

scripts_listing="$(find_shell_scripts scripts tests)"

if [ -z "${scripts_listing}" ]; then
  skip_gate "no shell scripts found under scripts/ or tests/"
fi

# Build a positional list. `shellcheck -x` follows `source=` directives so
# the lib helpers get checked alongside the gates that source them.
set --
while IFS= read -r f; do
  if [ -n "${f}" ]; then
    set -- "$@" "${f}"
  fi
done <<EOF
${scripts_listing}
EOF

count=$#
log_info "running shellcheck against ${count} script(s)"

set +e
# `-P SCRIPTDIR` tells shellcheck to resolve `# shellcheck source=` directives
# relative to each script's own directory, which is what every gate uses to
# pick up `lib/common.sh`. `-S style` raises severity to flag style nits too.
shellcheck -x -S style -P SCRIPTDIR "$@" >"${GATES_TMP_DIR}/shellcheck.out" 2>&1
rc=$?
set -e

if [ "${rc}" -ne 0 ]; then
  log_info "shellcheck output:"
  sed 's/^/    /' "${GATES_TMP_DIR}/shellcheck.out" >&2
  fail_gate "shellcheck reported diagnostics"
fi

pass_gate "${count} script(s) passed shellcheck -x"
