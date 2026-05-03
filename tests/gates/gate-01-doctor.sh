#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 01: scripts/doctor.sh exits 0 on a healthy host.
# Spec: §9.2, §11.2
# Pass: scripts/doctor.sh exists, is executable, and exits 0.
# Fail: scripts/doctor.sh exists but exits non-zero, or rejects --help.
# Skip: scripts/doctor.sh has not been added to the tree yet (T3 PR 3 ships
#       the skeleton; T2 PR 11 fills the body).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

doctor_script="$(repo_path scripts/doctor.sh)"

if [ ! -f "${doctor_script}" ]; then
  skip_gate "scripts/doctor.sh not present yet"
fi

if [ ! -x "${doctor_script}" ]; then
  fail_gate "scripts/doctor.sh exists but is not executable"
fi

set +e
"${doctor_script}" >"${GATES_TMP_DIR}/doctor.out" 2>&1
rc=$?
set -e

if [ "${rc}" -ne 0 ]; then
  log_info "doctor output:"
  sed 's/^/    /' "${GATES_TMP_DIR}/doctor.out" >&2
  fail_gate "scripts/doctor.sh exited ${rc}"
fi

pass_gate "scripts/doctor.sh exited 0"
