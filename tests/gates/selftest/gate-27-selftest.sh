#!/usr/bin/env bash
# tests/gates/selftest/gate-27-selftest.sh
#
# Synthetic TDD fixture proof for gate-27-citation-existence.sh.
# Lives in selftest/ so run-all.sh does NOT auto-discover it (run-all only
# scans tests/gates/gate-*.sh at the top level, not subdirs).
#
# Tests four cases, each in its own isolated fixture dir:
#   (a) known-good citation    → gate passes
#   (b) placeholder token      → gate ignores it → passes
#   (c) command-line fragment  → gate ignores it → passes
#   (d) deliberately-dangling  → gate fails
#
# Run directly:  bash tests/gates/selftest/gate-27-selftest.sh
# Exits 0 when all proofs pass, 1 when any proof fails.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATES_DIR="$(cd "${THIS_DIR}/.." && pwd)"
# shellcheck source=tests/gates/lib/common.sh
. "${GATES_DIR}/lib/common.sh"

FIXTURE_BASE="${GATES_TMP_DIR}/gate-27-fixtures"
mkdir -p "${FIXTURE_BASE}"
trap 'rm -rf "${FIXTURE_BASE}"' EXIT

OVERALL=0

run_gate_on_scope() {
  # Run gate-27 with a synthetic fixture dir and return the exit code.
  # $1 = synthetic repo root dir
  # GATE27_FIXTURE_DIR overrides the root gate-27 uses for scope + existence.
  set +e
  GATE27_FIXTURE_DIR="$1" bash "${GATES_DIR}/gate-27-citation-existence.sh" >/dev/null 2>&1
  _rc=$?
  set -e
  printf '%d' "${_rc}"
}

# ── Fixture (a): known-good citation ─────────────────────────────────────────
#
# A doc that cites `docs/guide.md` (backtick form). The file actually exists.
# Expected: gate passes (exit 0).

FIXTURE_A="${FIXTURE_BASE}/a-good"
rm -rf "${FIXTURE_A}"
mkdir -p "${FIXTURE_A}/docs"
# shellcheck disable=SC2016
printf '# Guide\n\nSee `docs/guide.md` for details.\n' \
  > "${FIXTURE_A}/docs/guide.md"
# shellcheck disable=SC2016
printf '# CLAUDE\n\nSee `docs/guide.md`.\n' \
  > "${FIXTURE_A}/CLAUDE.md"

# gate-27 also looks for SOFTWARE-3-0.md; create an empty stub so it passes scope.
touch "${FIXTURE_A}/SOFTWARE-3-0.md"
# gate-27 needs tests/gates/ for gate-NN lookups; seed with a proper stub gate.
mkdir -p "${FIXTURE_A}/tests/gates"
printf '#!/usr/bin/env bash\nexit 0\n' > "${FIXTURE_A}/tests/gates/gate-01-dummy.sh"

rc_a=$(run_gate_on_scope "${FIXTURE_A}")
if [ "${rc_a}" -eq 0 ]; then
  log_pass "gate-27-selftest: (a) known-good citation → gate PASSED (expected)"
else
  log_fail "gate-27-selftest: (a) known-good citation → gate returned ${rc_a}, expected 0"
  OVERALL=1
fi

# ── Fixture (b): placeholder token ───────────────────────────────────────────
#
# A doc that cites `src/x/<y>.ts` (contains < >). Must be ignored.
# Expected: gate passes (exit 0) — placeholders are not checked.

FIXTURE_B="${FIXTURE_BASE}/b-placeholder"
rm -rf "${FIXTURE_B}"
mkdir -p "${FIXTURE_B}/docs"
# shellcheck disable=SC2016
printf '# Docs\n\nSee `src/x/<y>.ts` for generics.\n' \
  > "${FIXTURE_B}/CLAUDE.md"
touch "${FIXTURE_B}/SOFTWARE-3-0.md"
mkdir -p "${FIXTURE_B}/tests/gates"
printf '#!/usr/bin/env bash\nexit 0\n' > "${FIXTURE_B}/tests/gates/gate-01-dummy.sh"

rc_b=$(run_gate_on_scope "${FIXTURE_B}")
if [ "${rc_b}" -eq 0 ]; then
  log_pass "gate-27-selftest: (b) placeholder token → gate PASSED (expected)"
else
  log_fail "gate-27-selftest: (b) placeholder token → gate returned ${rc_b}, expected 0"
  OVERALL=1
fi

# ── Fixture (c): command-line fragment ────────────────────────────────────────
#
# A doc that contains `bash run-all.sh` (has internal whitespace → excluded).
# Expected: gate passes (exit 0).

FIXTURE_C="${FIXTURE_BASE}/c-cmdline"
rm -rf "${FIXTURE_C}"
mkdir -p "${FIXTURE_C}/docs"
# shellcheck disable=SC2016
printf '# Install\n\nRun `bash tests/gates/run-all.sh` to verify.\n' \
  > "${FIXTURE_C}/CLAUDE.md"
touch "${FIXTURE_C}/SOFTWARE-3-0.md"
mkdir -p "${FIXTURE_C}/tests/gates"
printf '#!/usr/bin/env bash\nexit 0\n' > "${FIXTURE_C}/tests/gates/gate-01-dummy.sh"

rc_c=$(run_gate_on_scope "${FIXTURE_C}")
if [ "${rc_c}" -eq 0 ]; then
  log_pass "gate-27-selftest: (c) command-line fragment → gate PASSED (expected)"
else
  log_fail "gate-27-selftest: (c) command-line fragment → gate returned ${rc_c}, expected 0"
  OVERALL=1
fi

# ── Fixture (d): deliberately-dangling real path ──────────────────────────────
#
# A doc that cites `src/render/does-not-exist.ts` in backticks. That file
# does not exist in the fixture repo root.
# Expected: gate FAILS (exit 1).

FIXTURE_D="${FIXTURE_BASE}/d-dangling"
rm -rf "${FIXTURE_D}"
mkdir -p "${FIXTURE_D}/docs"
# shellcheck disable=SC2016
printf '# Docs\n\nSee `src/render/does-not-exist.ts` for the renderer.\n' \
  > "${FIXTURE_D}/CLAUDE.md"
touch "${FIXTURE_D}/SOFTWARE-3-0.md"
mkdir -p "${FIXTURE_D}/tests/gates"
printf '#!/usr/bin/env bash\nexit 0\n' > "${FIXTURE_D}/tests/gates/gate-01-dummy.sh"

rc_d=$(run_gate_on_scope "${FIXTURE_D}")
if [ "${rc_d}" -eq 1 ]; then
  log_pass "gate-27-selftest: (d) dangling path → gate FAILED (expected)"
else
  log_fail "gate-27-selftest: (d) dangling path → gate returned ${rc_d}, expected 1"
  OVERALL=1
fi

# ── Summary ──────────────────────────────────────────────────────────────────

if [ "${OVERALL}" -eq 0 ]; then
  log_pass "gate-27-selftest: all 4 fixture proofs pass"
  exit 0
else
  log_fail "gate-27-selftest: one or more fixture proofs failed"
  exit 1
fi
