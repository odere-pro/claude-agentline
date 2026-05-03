#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 05: every `*.md` file in the repo passes both `markdownlint-cli2`
# (against `.markdownlint.jsonc`) and `prettier --check`.
# Spec: §11.1, §11.2
# Pass: both tools exit 0 across every checked-in markdown file.
# Fail: either tool reports a diagnostic.
# Skip: neither `markdownlint-cli2` nor `prettier` is available, e.g. on a
#       host without npm. Each tool is skipped independently; the gate
#       passes when any tool ran cleanly and none failed, and skips when
#       neither tool could run.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

# Resolve the markdown corpus. Avoid `.git/`, `node_modules/`, and the
# scratch dirs that gate-02 also excludes.
md_files="$(cd "${REPO_ROOT}" && \
  find . -type f -name '*.md' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './tmp/*' \
    -not -path './tests/gates/.tmp/*' \
  | LC_ALL=C sort)"

if [ -z "${md_files}" ]; then
  skip_gate "no markdown files found"
fi

ran_anything=0
failed=0

# Resolve a runnable markdownlint command. Prefer a project-local install,
# then a global one, then `npx --no-install` so we never trigger a network
# fetch from CI by accident.
resolve_md_cmd() {
  if [ -x "${REPO_ROOT}/node_modules/.bin/markdownlint-cli2" ]; then
    printf '%s' "${REPO_ROOT}/node_modules/.bin/markdownlint-cli2"
    return 0
  fi
  if have_cmd markdownlint-cli2; then
    printf 'markdownlint-cli2'
    return 0
  fi
  return 1
}

resolve_prettier_cmd() {
  if [ -x "${REPO_ROOT}/node_modules/.bin/prettier" ]; then
    printf '%s' "${REPO_ROOT}/node_modules/.bin/prettier"
    return 0
  fi
  if have_cmd prettier; then
    printf 'prettier'
    return 0
  fi
  return 1
}

run_md_lint() {
  if ! md_cmd="$(resolve_md_cmd)"; then
    log_info "markdownlint-cli2 unavailable; skipping markdownlint check"
    return 0
  fi
  ran_anything=1
  log_info "markdownlint-cli2: ${md_cmd}"
  set +e
  # markdownlint-cli2 takes the file glob; pass each file explicitly.
  # shellcheck disable=SC2086
  ( cd "${REPO_ROOT}" && \
    printf '%s\n' ${md_files} | xargs "${md_cmd}" ) \
    >"${GATES_TMP_DIR}/gate-05-markdownlint.out" 2>&1
  rc=$?
  set -e
  if [ "${rc}" -ne 0 ]; then
    log_info "markdownlint-cli2 output:"
    sed 's/^/    /' "${GATES_TMP_DIR}/gate-05-markdownlint.out" >&2
    failed=1
  fi
}

run_prettier_check() {
  if ! pp_cmd="$(resolve_prettier_cmd)"; then
    log_info "prettier unavailable; skipping prettier check"
    return 0
  fi
  ran_anything=1
  log_info "prettier --check: ${pp_cmd}"
  set +e
  # shellcheck disable=SC2086
  ( cd "${REPO_ROOT}" && \
    printf '%s\n' ${md_files} | xargs "${pp_cmd}" --check ) \
    >"${GATES_TMP_DIR}/gate-05-prettier.out" 2>&1
  rc=$?
  set -e
  if [ "${rc}" -ne 0 ]; then
    log_info "prettier --check output:"
    sed 's/^/    /' "${GATES_TMP_DIR}/gate-05-prettier.out" >&2
    failed=1
  fi
}

run_md_lint
run_prettier_check

if [ "${failed}" -ne 0 ]; then
  fail_gate "markdown checks reported diagnostics"
fi
if [ "${ran_anything}" -eq 0 ]; then
  skip_gate "neither markdownlint-cli2 nor prettier is installed"
fi

pass_gate "markdown corpus passes markdownlint-cli2 and prettier --check"
