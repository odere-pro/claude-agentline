#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 10: `install --dry-run` makes NO filesystem changes.
# Spec: docs/cookbook/14-gates-catalogue.md §10
# Pass: snapshotting the sandbox (tree + every file's content) before and
#       after `scripts/install.sh --dry-run` yields an identical snapshot,
#       while the command still exits 0 and reports the actions it would
#       take ("would …" lines).
# Fail: --dry-run created, deleted, or modified any file.
# Skip: scripts absent, or node/bash not on PATH.
#
# Strict. Hermetic sandbox (HOME + CLAUDE_CONFIG_DIR + `agentline` shim).
# Run on a host that already has some Claude state so dry-run has real
# actions to (not) perform.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"
# shellcheck source=lib/install-sandbox.sh
. "$(dirname "$0")/lib/install-sandbox.sh"

install_gate_preflight

WORK="${GATES_TMP_DIR}/gate-10"
make_install_sandbox "${WORK}/sandbox"
trap 'rm -rf "${WORK}/sandbox" "${WORK}/sandbox-npmc" "${WORK}/sandbox-npmp"' EXIT

# Give dry-run something to act on: a pre-existing ~/.claude with a
# foreign statusLine (so it would back up + rewire) and an existing
# settings file (so skill/theme/config seeding all have real targets).
settings="$(sandbox_settings_file)"
mkdir -p "$(dirname "${settings}")"
printf '{ "statusLine": { "command": "starship init bash" }, "theme": "dark" }\n' >"${settings}"

# Snapshot BEFORE.
before="${WORK}/before.txt"
snapshot_tree_with_hashes "${SANDBOX_ROOT}" >"${before}"

# Dry-run install — must exit 0 and touch nothing.
if ! run_install "${WORK}/dryrun.out" --dry-run; then
  log_info "dry-run output:"; sed 's/^/    /' "${WORK}/dryrun.out" >&2
  fail_gate "install --dry-run exited non-zero"
fi

# Snapshot AFTER — must be identical.
after="${WORK}/after.txt"
snapshot_tree_with_hashes "${SANDBOX_ROOT}" >"${after}"

if ! diff -u "${before}" "${after}" >"${WORK}/snap.diff" 2>&1; then
  log_info "filesystem changed by --dry-run:"
  sed 's/^/    /' "${WORK}/snap.diff" >&2
  fail_gate "install --dry-run modified the filesystem"
fi

# Sanity: dry-run should still REPORT the actions it would take, so the
# parity is "reports without doing", not "does nothing and says nothing".
if ! grep -qi 'would\|dry-run' "${WORK}/dryrun.out"; then
  fail_gate "install --dry-run made no changes but also reported no planned actions"
fi

pass_gate "install --dry-run reports planned actions and changes nothing on disk"
