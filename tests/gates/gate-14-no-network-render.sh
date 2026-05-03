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

run_under_sandbox() {
  __os_kind="$1"
  case "${__os_kind}" in
    darwin)
      # sandbox-exec is part of base macOS. The profile allows everything
      # except network access (`network*` covers inet, unix, etc.).
      profile="${work_dir}/no-net.sb"
      cat >"${profile}" <<'SBPL'
(version 1)
(allow default)
(deny network*)
SBPL
      sandbox-exec -f "${profile}" \
        node "${bin}" \
        <"${fixture}" \
        >"${stdout_file}" 2>"${stderr_file}"
      ;;
    linux)
      # `unshare -nr` opens a fresh network namespace and maps the caller
      # to root inside it; the loopback interface stays down so any
      # outbound socket attempt fails with ENETUNREACH / EHOSTUNREACH.
      unshare -nr \
        node "${bin}" \
        <"${fixture}" \
        >"${stdout_file}" 2>"${stderr_file}"
      ;;
  esac
}

# OS detection. Bash 3.2 friendly — no [[ =~ ]] regex.
uname_out="$(uname -s 2>/dev/null || echo unknown)"
case "${uname_out}" in
  Darwin)
    if ! have_cmd sandbox-exec; then
      skip_gate "sandbox-exec missing on Darwin; cannot block network"
    fi
    os_kind="darwin"
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

set +e
run_under_sandbox "${os_kind}"
rc=$?
set -e

if [ "${rc}" -ne 0 ]; then
  log_info "render exited with rc=${rc} under network sandbox"
  if [ -s "${stderr_file}" ]; then
    log_info "render stderr:"
    sed 's/^/    /' "${stderr_file}" >&2
  fi
  if [ -s "${stdout_file}" ]; then
    log_info "render stdout:"
    sed 's/^/    /' "${stdout_file}" >&2
  fi
  fail_gate "render path failed with no network — the hot path likely makes an outbound call"
fi

if [ ! -s "${stdout_file}" ]; then
  fail_gate "render produced empty stdout under network sandbox"
fi

pass_gate "render path runs offline (${os_kind} sandbox)"
