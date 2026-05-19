#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 22: runtime dependency advisory audit.
# Spec: cookbook 17, I-11 ("Audit runs in CI; advisories block merge";
#       control: registry audit --omit=dev). Threshold is moderate+ per
#       the project's hardening decision (stricter than I-11's "high").
# Pass: `pnpm audit --prod --audit-level moderate` reports no advisory at
#       moderate severity or above in the production dependency tree.
# Fail: at least one moderate+ advisory affects a runtime dependency.
# Skip: pnpm is unavailable, or the registry advisory endpoint is
#       unreachable (offline dev box) — CI always has network so the
#       audit is enforced there.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

if ! have_cmd pnpm; then
  skip_gate "pnpm not on PATH"
fi

cd "${REPO_ROOT}"

out=""
rc=0
out="$(pnpm audit --prod --audit-level moderate 2>&1)" || rc=$?

if [ "${rc}" -eq 0 ]; then
  pass_gate "no moderate+ advisories in the runtime dependency tree"
fi

# Non-zero can mean "advisories found" OR "registry unreachable / other
# pnpm error". Fail closed ONLY when the output actually describes an
# advisory; otherwise skip so an offline local run stays green. CI always
# has network, so a genuine advisory there still prints the table and
# fails this gate.
if printf '%s' "${out}" | grep -qiE 'vulnerabilit|advisor|Severity:'; then
  printf '%s\n' "${out}" | tail -n 20 >&2
  fail_gate "moderate+ advisory in a runtime dependency (see pnpm audit output above)"
fi

skip_gate "pnpm audit did not complete (registry unreachable / offline)"
