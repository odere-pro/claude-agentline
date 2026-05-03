#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 04: `scripts/init.sh` run twice yields no diff.
# Spec: §10, §11.2
# Pass: a fresh project directory looks identical after one and two
#       successive `init.sh` runs.
# Fail: the second run mutates the project directory in any observable way.
# Skip: `scripts/init.sh` not present yet.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

init_script="$(repo_path scripts/init.sh)"

if [ ! -f "${init_script}" ]; then
  skip_gate "scripts/init.sh not present yet"
fi
if [ ! -x "${init_script}" ]; then
  fail_gate "scripts/init.sh exists but is not executable"
fi

# Isolated project sandbox — never touch the real $CLAUDE_PROJECT_DIR.
work_root="${GATES_TMP_DIR}/gate-04"
rm -rf "${work_root}"
mkdir -p "${work_root}/project"
project_dir="${work_root}/project"

# Run 1.
CLAUDE_PROJECT_DIR="${project_dir}" \
  "${init_script}" >"${GATES_TMP_DIR}/gate-04-run1.out" 2>&1 \
  || fail_gate "first init run failed (rc=$?); see ${GATES_TMP_DIR}/gate-04-run1.out"

# Snapshot the working tree contents so we can diff after the second run.
# `find ... -print0 | xargs -0 ... shasum` keeps file content + mode in
# scope while ignoring mtime drift.
snapshot() {
  __dir="$1"
  __out="$2"
  (
    cd "${__dir}"
    find . -mindepth 1 \( -type f -o -type l \) -print 2>/dev/null \
      | LC_ALL=C sort \
      | while IFS= read -r p; do
          if [ -L "${p}" ]; then
            printf 'L\t%s\t%s\n' "${p}" "$(readlink "${p}")"
          else
            printf 'F\t%s\t%s\n' "${p}" "$(shasum "${p}" | awk '{print $1}')"
          fi
        done
  ) >"${__out}"
}

snapshot "${project_dir}" "${GATES_TMP_DIR}/gate-04-snap1.txt"

# Run 2.
CLAUDE_PROJECT_DIR="${project_dir}" \
  "${init_script}" >"${GATES_TMP_DIR}/gate-04-run2.out" 2>&1 \
  || fail_gate "second init run failed (rc=$?); see ${GATES_TMP_DIR}/gate-04-run2.out"

snapshot "${project_dir}" "${GATES_TMP_DIR}/gate-04-snap2.txt"

if ! diff -u \
  "${GATES_TMP_DIR}/gate-04-snap1.txt" \
  "${GATES_TMP_DIR}/gate-04-snap2.txt" \
  >"${GATES_TMP_DIR}/gate-04-diff.txt"; then
  log_info "init produced a diff between run 1 and run 2:"
  sed 's/^/    /' "${GATES_TMP_DIR}/gate-04-diff.txt" >&2
  fail_gate "init.sh is not idempotent"
fi

pass_gate "init.sh is idempotent across two consecutive runs"
