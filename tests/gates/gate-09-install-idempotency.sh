#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 09: a second `install` run is a no-op.
# Spec: docs/cookbook/14-gates-catalogue.md §9
# Pass: running install twice leaves the sandbox tree + every file's
#       content byte-identical after the second run (statusLine already
#       wired → nothing to do; config not re-seeded over a user edit;
#       themes/skills skipped when already present).
# Fail: the second install changes any file (tree shape or content) — the
#       install path is not idempotent. (This is the gate the brainstorm
#       flagged would have caught the `--force` log-only regression.)
# Skip: scripts absent, or node/bash not on PATH.
#
# Strict. Hermetic sandbox (HOME + CLAUDE_CONFIG_DIR + `agentline` shim).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"
# shellcheck source=lib/install-sandbox.sh
. "$(dirname "$0")/lib/install-sandbox.sh"

install_gate_preflight

WORK="${GATES_TMP_DIR}/gate-09"
make_install_sandbox "${WORK}/sandbox"
trap 'rm -rf "${WORK}/sandbox" "${WORK}/sandbox-npmc" "${WORK}/sandbox-npmp"' EXIT

# Pre-create ~/.claude so the FIRST install already seeds skills — that
# way the second run has nothing new to add and the trees can match. (A
# first run that itself creates ~/.claude would flip the skill-seeding
# branch between runs, which is expected and not an idempotency defect.)
mkdir -p "${SANDBOX_HOME}/.claude"

# First install.
if ! run_install "${WORK}/install1.out"; then
  log_info "install #1 output:"; sed 's/^/    /' "${WORK}/install1.out" >&2
  fail_gate "first install exited non-zero"
fi
snap1="${WORK}/snap1.txt"
snapshot_tree_with_hashes "${SANDBOX_ROOT}" >"${snap1}"

# Second install — must be a pure no-op.
if ! run_install "${WORK}/install2.out"; then
  log_info "install #2 output:"; sed 's/^/    /' "${WORK}/install2.out" >&2
  fail_gate "second install exited non-zero"
fi
snap2="${WORK}/snap2.txt"
snapshot_tree_with_hashes "${SANDBOX_ROOT}" >"${snap2}"

if ! diff -u "${snap1}" "${snap2}" >"${WORK}/snap.diff" 2>&1; then
  log_info "tree/content diff after second install:"
  sed 's/^/    /' "${WORK}/snap.diff" >&2
  fail_gate "second install changed the on-disk tree — install is not idempotent"
fi

pass_gate "second install is a no-op — tree + content byte-identical"
