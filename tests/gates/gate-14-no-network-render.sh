#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 14: the render hot path makes no outbound network call.
# Spec: §1.2 N5, §11.2 G14
# Pass: `node dist/cli.mjs` (default render command) reads a fixture from
#       stdin, exits 0, and writes a non-empty line under a sandbox that
#       denies all network syscalls.
# Fail: render exits non-zero, produces no output, or is blocked by the
#       sandbox in a way that surfaces a network attempt.
# Skip: `dist/cli.mjs` absent, or the host has no supported sandbox
#       (no `sandbox-exec` on macOS, no `unshare` on Linux, Windows always).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`npm run build\` to activate"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

work_dir="${GATES_TMP_DIR}/gate-14"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

# Fixture mirrors the documented Claude Code statusline contract (§8.1).
# We keep it minimal: enough to exercise the render path without inviting
# widget-specific fan-out (git, tokens, etc.). Those are tested separately;
# here the question is whether *render itself* touches the network.
fixture="${work_dir}/payload.json"
cat >"${fixture}" <<'JSON'
{
  "model": "sonnet-4.6",
  "version": "0.0.0",
  "outputStyle": "default",
  "sessionId": "11111111-1111-1111-1111-111111111111",
  "sessionName": "gate-14",
  "cwd": "/tmp/agentline-gate-14",
  "thinkingEffort": "medium",
  "vimMode": "off"
}
JSON

stdout_file="${work_dir}/stdout.txt"
stderr_file="${work_dir}/stderr.txt"

# Run a command under the OS network sandbox. The caller supplies the full
# argv (node + bin + flags) and owns stdio redirection. `os_kind` / `profile`
# are set by the OS-detection block below before the first call.
#   darwin: sandbox-exec is part of base macOS; the profile allows everything
#           except network (`network*` covers inet, unix, etc.).
#   linux:  `unshare -nr` opens a fresh network namespace mapped to root, with
#           loopback down, so any outbound socket fails ENETUNREACH/EHOSTUNREACH.
sandbox_run() {
  case "${os_kind}" in
    darwin) sandbox-exec -f "${profile}" "$@" ;;
    linux) unshare -nr "$@" ;;
  esac
}

# Assert a sandboxed render exited cleanly and wrote a non-empty line.
# A non-zero exit with no network is the signature of an attempted outbound
# call on the hot path; an empty stdout means the host UI would go blank.
assert_offline_ok() {
  __rc="$1"
  __out="$2"
  __err="$3"
  __label="$4"
  if [ "${__rc}" -ne 0 ]; then
    log_info "${__label} exited with rc=${__rc} under network sandbox"
    if [ -s "${__err}" ]; then
      log_info "${__label} stderr:"
      sed 's/^/    /' "${__err}" >&2
    fi
    if [ -s "${__out}" ]; then
      log_info "${__label} stdout:"
      sed 's/^/    /' "${__out}" >&2
    fi
    fail_gate "${__label} failed with no network — the hot path likely makes an outbound call"
  fi
  if [ ! -s "${__out}" ]; then
    fail_gate "${__label} produced empty stdout under network sandbox"
  fi
}

# OS detection. Bash 3.2 friendly — no [[ =~ ]] regex.
uname_out="$(uname -s 2>/dev/null || echo unknown)"
case "${uname_out}" in
  Darwin)
    if ! have_cmd sandbox-exec; then
      skip_gate "sandbox-exec missing on Darwin; cannot block network"
    fi
    os_kind="darwin"
    profile="${work_dir}/no-net.sb"
    cat >"${profile}" <<'SBPL'
(version 1)
(allow default)
(deny network*)
SBPL
    ;;
  Linux)
    if ! have_cmd unshare; then
      skip_gate "unshare missing on Linux; cannot open a fresh net namespace"
    fi
    # Verify unshare actually grants a fresh namespace on this host.
    # Some hardened CI images disable user namespaces; the gate should
    # skip rather than fail in that case.
    if ! unshare -nr true >/dev/null 2>&1; then
      skip_gate "unshare -nr is not permitted on this host"
    fi
    os_kind="linux"
    ;;
  *)
    skip_gate "no supported network sandbox for OS '${uname_out}'"
    ;;
esac

# 1) Default render path: payload on stdin, no widget fan-out.
set +e
sandbox_run node "${bin}" <"${fixture}" >"${stdout_file}" 2>"${stderr_file}"
rc=$?
set -e
assert_offline_ok "${rc}" "${stdout_file}" "${stderr_file}" "default render"

# 2) The `--git` synthetic-git replay vector (#255/#273). The golden channel
#    injects a static GitState from disk, so even the network-opt-in scenario
#    (`allowNetwork: true`) must render fully offline — an injected snapshot
#    never reaches the live PR loader. Replaying git-pr-network-optin under the
#    same sandbox locks that in, so a future regression wiring `--git` to a live
#    fetch fails here instead of shipping.
git_scenario="$(repo_path tests/golden/git-pr-network-optin)"
if [ -d "${git_scenario}" ]; then
  git_stdout="${work_dir}/git-stdout.txt"
  git_stderr="${work_dir}/git-stderr.txt"
  set +e
  sandbox_run node "${bin}" render \
    --fixture "${git_scenario}/stdin.json" \
    --config "${git_scenario}/config.json" \
    --git "${git_scenario}/git.json" \
    --frozen-clock "$(cat "${git_scenario}/clock.txt")" \
    --width 80 --no-color \
    </dev/null >"${git_stdout}" 2>"${git_stderr}"
  git_rc=$?
  set -e
  assert_offline_ok "${git_rc}" "${git_stdout}" "${git_stderr}" "--git replay (git-pr-network-optin)"
else
  log_info "git-pr-network-optin scenario absent; skipping --git sandbox check"
fi

pass_gate "render path runs offline (${os_kind} sandbox)"
