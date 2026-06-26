#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 29: agentline's knowledge of the Claude Code statusline payload stays in
# sync with a captured live payload fixture AND the data-contract doc table.
# Spec: docs/cookbook/14-gates-catalogue.md §29
# Pass: `node scripts/check-host-contract.mjs --check` reports in sync — every
#       host-sent key in tests/fixtures/host-payload-<version>.json is consumed
#       by a raw-reader or explicitly ignored; no ignored key is over-captured;
#       the set of raw-reader modules equals the harness's exercised set; and
#       the `Raw key` column of docs/cookbook/06-data-contracts.md equals the
#       consumed host fields (no phantom rows, no missing rows).
# Fail: the host sends a field nothing reads (silent-drop drift), a reader was
#       added without wiring it into the harness, or the doc table drifted.
# Skip: node is unavailable, or esbuild is not installed (lean runtime install);
#       CI installs devDeps so it runs there.
#
# Mode: STRICT. Productizes the manual `agentline-claude-code-watcher` local
# diff so the next host-contract drift fails CI instead of waiting for a sync.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

check_script="$(repo_path scripts/check-host-contract.mjs)"
if [ ! -f "${check_script}" ]; then
  skip_gate "scripts/check-host-contract.mjs not present"
fi

esbuild_pkg="$(repo_path node_modules/esbuild/package.json)"
if [ ! -f "${esbuild_pkg}" ]; then
  skip_gate "esbuild not installed; run \`pnpm install\` to activate"
fi

if node "${check_script}" --check; then
  pass_gate "host contract is in sync with the fixture and the data-contract doc"
else
  fail_gate "host-contract drift — see scripts/check-host-contract.mjs output above"
fi
