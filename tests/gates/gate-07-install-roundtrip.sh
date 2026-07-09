#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 07: install + uninstall round-trip restores the prior host state.
# Spec: docs/cookbook/14-gates-catalogue.md §7
# Pass: after install, the host `statusLine` is wired to agentline; after
#       uninstall, a pre-existing foreign `statusLine` is restored
#       byte-for-byte and the seeded agentline config/themes are gone.
# Fail: the foreign statusLine is not restored, or an agentline footprint
#       (config/themes) is left behind after uninstall.
# Skip: scripts absent, or node/bash not on PATH.
#
# Strict. Hermetic: runs entirely inside a temp sandbox (HOME +
# CLAUDE_CONFIG_DIR + an `agentline` shim on PATH so the global npm
# install is skipped). Never touches the real ~/.claude.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"
# shellcheck source=lib/install-sandbox.sh
. "$(dirname "$0")/lib/install-sandbox.sh"

install_gate_preflight

WORK="${GATES_TMP_DIR}/gate-07"
make_install_sandbox "${WORK}/sandbox"
trap 'rm -rf "${WORK}/sandbox" "${WORK}/sandbox-npmc" "${WORK}/sandbox-npmp"' EXIT

settings="$(sandbox_settings_file)"
foreign='starship init bash'

# Seed a pre-existing foreign statusLine the host owned before agentline.
mkdir -p "$(dirname "${settings}")"
printf '{ "statusLine": { "command": "%s" } }\n' "${foreign}" >"${settings}"

# 1. Install — must wire statusLine to agentline.
if ! run_install "${WORK}/install.out"; then
  log_info "install output:"
  sed 's/^/    /' "${WORK}/install.out" >&2
  fail_gate "install exited non-zero"
fi

wired="$(sandbox_json_key "${settings}" statusLine)"
case "${wired}" in
  *agentline*) : ;;
  *) fail_gate "after install, statusLine is not wired to agentline (got: ${wired})" ;;
esac

# 2. Uninstall — must restore the foreign statusLine and drop agentline.
if ! run_uninstall "${WORK}/uninstall.out"; then
  log_info "uninstall output:"
  sed 's/^/    /' "${WORK}/uninstall.out" >&2
  fail_gate "uninstall exited non-zero"
fi

restored="$(sandbox_json_key "${settings}" statusLine)"
expected="$(AL_S="${foreign}" node -e 'process.stdout.write(JSON.stringify({command:process.env.AL_S}))')"
if [ "${restored}" != "${expected}" ]; then
  fail_gate "foreign statusLine not restored after round-trip (expected ${expected}, got ${restored})"
fi

# 3. No agentline footprint left behind (config + bundled themes gone).
if [ -f "${SANDBOX_CFG}/config.json" ]; then
  fail_gate "agentline config.json left behind after uninstall"
fi
if [ -f "${SANDBOX_CFG}/themes/claude-code-dark.json" ]; then
  fail_gate "bundled theme left behind after uninstall"
fi

pass_gate "install wires statusLine; uninstall restores prior state byte-for-byte"
