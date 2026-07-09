#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 08: install + uninstall preserve every non-`statusLine` settings key.
# Spec: docs/cookbook/14-gates-catalogue.md §8
# Pass: a settings.json carrying unrelated user keys (theme, hooks, env)
#       has those keys byte-identical before install and after uninstall —
#       agentline only ever touches `statusLine`.
# Fail: any non-statusLine key is added, removed, or mutated by the
#       install/uninstall round-trip.
# Skip: scripts absent, or node/bash not on PATH.
#
# Strict. Hermetic sandbox (HOME + CLAUDE_CONFIG_DIR + `agentline` shim).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"
# shellcheck source=lib/install-sandbox.sh
. "$(dirname "$0")/lib/install-sandbox.sh"

install_gate_preflight

WORK="${GATES_TMP_DIR}/gate-08"
mkdir -p "${WORK}"
make_install_sandbox "${WORK}/sandbox"
trap 'rm -rf "${WORK}/sandbox" "${WORK}/sandbox-npmc" "${WORK}/sandbox-npmp"' EXIT

settings="$(sandbox_settings_file)"
mkdir -p "$(dirname "${settings}")"

# A settings.json with several unrelated user keys alongside a foreign
# statusLine. Every key EXCEPT statusLine must survive the round-trip.
cat >"${settings}" <<'JSON'
{
  "theme": "dark",
  "statusLine": { "command": "starship init bash" },
  "hooks": { "PreToolUse": [{ "matcher": "Bash", "command": "echo hi" }] },
  "env": { "FOO": "bar" },
  "permissions": { "allow": ["Read"] }
}
JSON

# Snapshot each non-statusLine key BEFORE, into a per-key file (avoids
# `eval` — shellcheck-clean and easier to diff).
keys='theme hooks env permissions'
for k in ${keys}; do
  sandbox_json_key "${settings}" "${k}" >"${WORK}/before-${k}.json"
done

if ! run_install "${WORK}/install.out"; then
  log_info "install output:"; sed 's/^/    /' "${WORK}/install.out" >&2
  fail_gate "install exited non-zero"
fi
if ! run_uninstall "${WORK}/uninstall.out"; then
  log_info "uninstall output:"; sed 's/^/    /' "${WORK}/uninstall.out" >&2
  fail_gate "uninstall exited non-zero"
fi

# Every non-statusLine key must be byte-identical after the round-trip.
FAIL=0
for k in ${keys}; do
  sandbox_json_key "${settings}" "${k}" >"${WORK}/after-${k}.json"
  if ! diff -q "${WORK}/before-${k}.json" "${WORK}/after-${k}.json" >/dev/null 2>&1; then
    before_val="$(cat "${WORK}/before-${k}.json")"
    after_val="$(cat "${WORK}/after-${k}.json")"
    log_fail "$(gate_self_id): non-statusLine key '${k}' changed (before=${before_val} after=${after_val})"
    FAIL=1
  fi
done

if [ "${FAIL}" -ne 0 ]; then
  fail_gate "install/uninstall mutated a non-statusLine settings key"
fi

pass_gate "install/uninstall preserve every non-statusLine settings key"
