#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 15: published-package smoke. Pack the repo with `npm pack`, install
# the resulting tarball into an isolated prefix, then pipe a canonical
# Claude Code statusline payload through the installed bin and assert the
# exact stdout. The CI matrix in `.github/workflows/install-matrix.yml`
# runs the same recipe across every {OS} × {Node 20, Node 22} cell; this
# gate is the local equivalent so contributors can validate before push.
# Spec: §1.2 N1, §11.2 G15
#
# Pass: tarball installs cleanly, render smoke matches expected bytes.
# Fail: pack/install/render fails or output bytes differ.
# Skip: `npm` not on PATH (host can't pack).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

if ! have_cmd npm; then
  skip_gate "npm not on PATH"
fi
if ! have_cmd node; then
  skip_gate "node not on PATH"
fi

work_root="${GATES_TMP_DIR}/gate-15"
rm -rf "${work_root}"
mkdir -p "${work_root}"

# Build first so dist/cli.mjs exists when `npm pack` runs (`prepublishOnly`
# would build for us, but skipping it keeps the gate fast on re-runs where
# the bin is already current).
if [ ! -f "${REPO_ROOT}/dist/cli.mjs" ]; then
  log_info "building dist/cli.mjs"
  (cd "${REPO_ROOT}" && npm run build >"${work_root}/build.log" 2>&1) \
    || fail_gate "npm run build failed; see ${work_root}/build.log"
fi

log_info "packing tarball"
pack_out="${work_root}/pack.log"
tarball_name="$(cd "${REPO_ROOT}" && npm pack --pack-destination="${work_root}" --json 2>"${pack_out}" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const a=JSON.parse(d);process.stdout.write(a[0].filename)})')"
if [ -z "${tarball_name}" ] || [ ! -f "${work_root}/${tarball_name}" ]; then
  log_info "pack output:"
  sed 's/^/    /' "${pack_out}" >&2 || true
  fail_gate "npm pack did not produce a tarball"
fi
tarball="${work_root}/${tarball_name}"

prefix="${work_root}/prefix"
mkdir -p "${prefix}"

log_info "installing tarball into isolated prefix"
install_out="${work_root}/install.log"
(cd "${work_root}" && npm install --global --prefix="${prefix}" --no-audit --no-fund "${tarball}" >"${install_out}" 2>&1) \
  || { sed 's/^/    /' "${install_out}" >&2; fail_gate "npm install of tarball failed"; }

# POSIX hosts put bins under <prefix>/bin; Windows puts them at <prefix>.
bin=""
for cand in "${prefix}/bin/agentline" "${prefix}/agentline" "${prefix}/bin/agentline.cmd" "${prefix}/agentline.cmd"; do
  if [ -e "${cand}" ]; then
    bin="${cand}"
    break
  fi
done
if [ -z "${bin}" ]; then
  log_info "prefix tree after install:"
  find "${prefix}" -maxdepth 3 >&2 || true
  fail_gate "agentline bin not found under ${prefix}"
fi

log_info "smoke-rendering installed bin: ${bin}"
# `gate-15` is not a known model id, so the `model` widget falls
# back to rendering the raw id as-is. The rest of the default
# config widgets hide (no transcript, no git repo, etc.) so the
# expected line is simply the raw model id.
fixture_in='{"model":"gate-15","cwd":"/agentline/gate-15"}'
expected='gate-15'

actual="$(printf '%s' "${fixture_in}" | NO_COLOR=1 "${bin}" 2>"${work_root}/render.err")" \
  || { sed 's/^/    /' "${work_root}/render.err" >&2; fail_gate "render exited non-zero"; }

# Strip a single trailing newline if present so comparison stays byte-exact
# regardless of how the host shell captures stdout.
case "${actual}" in
  *$'\n') actual="${actual%$'\n'}" ;;
esac

if [ "${actual}" != "${expected}" ]; then
  printf 'expected: %q\nactual:   %q\n' "${expected}" "${actual}" >&2
  fail_gate "render smoke output mismatch"
fi

pass_gate "tarball installs and renders the canonical fixture"
