#!/usr/bin/env bash
# tests/gates/selftest/gate-29-selftest.sh
#
# Synthetic TDD fixture proof for gate-29-host-contract-conformance.sh and its
# checker scripts/check-host-contract.mjs. Lives in selftest/ so run-all.sh does
# NOT auto-discover it (run-all only scans tests/gates/gate-*.sh at the top
# level, not subdirs).
#
# The checker always bundles the REAL adapter / session / usage readers from
# src/, so only the fixture payload and the doc table vary here (via the
# HOST_CONTRACT_FIXTURE / HOST_CONTRACT_DOC env overrides). Four cases:
#   (a) good fixture + good doc        → checker passes
#   (b) fixture sends an unconsumed,
#       non-allowlisted key            → checker fails  (Assertion A1)
#   (c) doc drops a consumed row       → checker fails  (Assertion B missing)
#   (d) doc adds a phantom Raw key row → checker fails  (Assertion B phantom)
#
# Run directly:  bash tests/gates/selftest/gate-29-selftest.sh
# Exits 0 when all proofs pass, 1 when any proof fails.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATES_DIR="$(cd "${THIS_DIR}/.." && pwd)"
# shellcheck source=tests/gates/lib/common.sh
. "${GATES_DIR}/lib/common.sh"

CHECK_SCRIPT="${REPO_ROOT}/scripts/check-host-contract.mjs"
REAL_FIXTURE="${REPO_ROOT}/tests/fixtures/host-payload-2.1.193.json"
REAL_DOC="${REPO_ROOT}/docs/cookbook/06-data-contracts.md"

if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi
if [ ! -f "${REPO_ROOT}/node_modules/esbuild/package.json" ]; then
  skip_gate "esbuild not installed; run \`pnpm install\` to activate"
fi

FIXTURE_BASE="${GATES_TMP_DIR}/gate-29-fixtures"
rm -rf "${FIXTURE_BASE}"
mkdir -p "${FIXTURE_BASE}"
trap 'rm -rf "${FIXTURE_BASE}"' EXIT

OVERALL=0

run_check() {
  # $1 = fixture path, $2 = doc path. Echoes the checker exit code.
  set +e
  HOST_CONTRACT_FIXTURE="$1" HOST_CONTRACT_DOC="$2" node "${CHECK_SCRIPT}" >/dev/null 2>&1
  _rc=$?
  set -e
  printf '%d' "${_rc}"
}

# ── Baseline good copies ─────────────────────────────────────────────────────
GOOD_FIXTURE="${FIXTURE_BASE}/good.json"
GOOD_DOC="${FIXTURE_BASE}/good.md"
cp "${REAL_FIXTURE}" "${GOOD_FIXTURE}"
cp "${REAL_DOC}" "${GOOD_DOC}"

# ── (a) good fixture + good doc → pass ───────────────────────────────────────
rc_a=$(run_check "${GOOD_FIXTURE}" "${GOOD_DOC}")
if [ "${rc_a}" -eq 0 ]; then
  log_pass "gate-29-selftest: (a) good fixture + good doc → checker PASSED (expected)"
else
  log_fail "gate-29-selftest: (a) good fixture + good doc → returned ${rc_a}, expected 0"
  OVERALL=1
fi

# ── (b) fixture sends an unconsumed, non-allowlisted key → fail (A1) ──────────
BAD_B="${FIXTURE_BASE}/bad-b.json"
node -e '
  const fs = require("fs");
  const o = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  o.brand_new_field = "the host just started sending this";
  fs.writeFileSync(process.argv[2], JSON.stringify(o, null, 2));
' "${GOOD_FIXTURE}" "${BAD_B}"
rc_b=$(run_check "${BAD_B}" "${GOOD_DOC}")
if [ "${rc_b}" -eq 1 ]; then
  log_pass "gate-29-selftest: (b) unconsumed host key → checker FAILED (expected)"
else
  log_fail "gate-29-selftest: (b) unconsumed host key → returned ${rc_b}, expected 1"
  OVERALL=1
fi

# ── (c) doc drops a consumed row → fail (B missing) ──────────────────────────
BAD_C="${FIXTURE_BASE}/bad-c.md"
# Drop the table row whose Raw key cell is `cost` (a real consumed field).
# shellcheck disable=SC2016  # literal backticks in the markdown table cell, no expansion intended
grep -v '| `cost` *|' "${GOOD_DOC}" > "${BAD_C}"
rc_c=$(run_check "${GOOD_FIXTURE}" "${BAD_C}")
if [ "${rc_c}" -eq 1 ]; then
  log_pass "gate-29-selftest: (c) doc missing a consumed row → checker FAILED (expected)"
else
  log_fail "gate-29-selftest: (c) doc missing a consumed row → returned ${rc_c}, expected 1"
  OVERALL=1
fi

# ── (d) doc adds a phantom Raw key row → fail (B phantom) ─────────────────────
BAD_D="${FIXTURE_BASE}/bad-d.md"
# Insert a phantom row (Raw key `bogus`) just before the "Other host fields" row.
awk '
  /^\| Other host fields/ && !done {
    print "| `bogus` | `bogus` | string | a field nothing consumes |"
    done = 1
  }
  { print }
' "${GOOD_DOC}" > "${BAD_D}"
rc_d=$(run_check "${GOOD_FIXTURE}" "${BAD_D}")
if [ "${rc_d}" -eq 1 ]; then
  log_pass "gate-29-selftest: (d) doc phantom row → checker FAILED (expected)"
else
  log_fail "gate-29-selftest: (d) doc phantom row → returned ${rc_d}, expected 1"
  OVERALL=1
fi

# ── Summary ──────────────────────────────────────────────────────────────────
if [ "${OVERALL}" -eq 0 ]; then
  log_pass "gate-29-selftest: all 4 fixture proofs pass"
  exit 0
else
  log_fail "gate-29-selftest: one or more fixture proofs failed"
  exit 1
fi
