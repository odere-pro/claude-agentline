#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 24: local mirror of the secret-scan CI workflow (cookbook 17,
# "Secret handling"). Lets a developer catch a leaked credential before
# pushing, using the same .gitleaks.toml the workflow enforces.
# Pass: gitleaks finds no secret in the repo.
# Fail: gitleaks reports at least one finding (output redacted).
# Skip: gitleaks is not installed (CI installs it via the action), or it
#       could not complete — the workflow is the enforcing control.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

if ! have_cmd gitleaks; then
  skip_gate "gitleaks not on PATH (enforced in CI via secret-scan.yml)"
fi

cd "${REPO_ROOT}"

out=""
rc=0
out="$(gitleaks detect --no-banner --redact --source . --config .gitleaks.toml 2>&1)" || rc=$?

if [ "${rc}" -eq 0 ]; then
  pass_gate "no secrets detected"
fi

if [ "${rc}" -eq 1 ]; then
  printf '%s\n' "${out}" | tail -n 20 >&2
  fail_gate "gitleaks reported a potential secret (redacted output above)"
fi

skip_gate "gitleaks could not complete (rc=${rc})"
