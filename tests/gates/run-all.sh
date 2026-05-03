#!/usr/bin/env bash
# tests/gates/run-all.sh
# Discover every gate-NN-*.sh sibling, run it, and report a final table.
# Exit contract honoured strictly:
#   0 = every gate passed (skips allowed)
#   1 = at least one gate failed
# Spec: §11.2

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "${THIS_DIR}/lib/common.sh"

RESULTS_NDJSON="${GATES_TMP_DIR}/results.ndjson"
: > "${RESULTS_NDJSON}"

# Collect the gate scripts. Numerically sorted by the NN prefix.
gates=""
for f in "${THIS_DIR}"/gate-*.sh; do
  if [ -f "${f}" ]; then
    gates="${gates} ${f}"
  fi
done
if [ -z "${gates}" ]; then
  log_info "no gates discovered under ${THIS_DIR}"
  exit 0
fi

# Sort by basename (LC_ALL=C keeps numeric prefixes stable). The `gates`
# string is intentionally word-split on whitespace; each element is an
# absolute path to a gate script under tests/gates/.
# shellcheck disable=SC2086
sorted_gates="$(printf '%s\n' ${gates} | LC_ALL=C sort)"

pass_count=0
skip_count=0
fail_count=0
failed_ids=""

log_info "running gates from ${THIS_DIR}"

for gate in ${sorted_gates}; do
  id="$(basename "${gate%.sh}")"
  log_file="${GATES_TMP_DIR}/${id}.log"

  set +e
  bash "${gate}" >"${log_file}" 2>&1
  rc=$?
  set -e

  case "${rc}" in
    0)
      status="pass"
      pass_count=$((pass_count + 1))
      log_pass "${id}"
      ;;
    2)
      status="skip"
      skip_count=$((skip_count + 1))
      reason="$(grep -E '^\[skip\]' "${log_file}" 2>/dev/null | tail -n 1 || true)"
      if [ -n "${reason}" ]; then
        printf '  %s%s%s\n' "${__C_DIM}" "${reason}" "${__C_RESET}"
      else
        log_skip "${id}"
      fi
      ;;
    1)
      status="fail"
      fail_count=$((fail_count + 1))
      failed_ids="${failed_ids} ${id}"
      log_fail "${id} (see ${log_file})"
      # Surface the gate's own stderr at top level so CI logs are useful.
      sed 's/^/    /' "${log_file}" >&2
      ;;
    *)
      status="error"
      fail_count=$((fail_count + 1))
      failed_ids="${failed_ids} ${id}"
      log_fail "${id}: invalid exit code ${rc} (must be 0/1/2; see ${log_file})"
      sed 's/^/    /' "${log_file}" >&2
      ;;
  esac

  printf '{"gate":"%s","status":"%s","exit":%d,"log":"%s"}\n' \
    "${id}" "${status}" "${rc}" "${log_file}" >>"${RESULTS_NDJSON}"
done

total=$((pass_count + skip_count + fail_count))

printf '\n%s---- gate summary ----%s\n' "${__C_DIM}" "${__C_RESET}"
printf '%s%d passed%s, %s%d skipped%s, %s%d failed%s (of %d)\n' \
  "${__C_GREEN}" "${pass_count}" "${__C_RESET}" \
  "${__C_YELLOW}" "${skip_count}" "${__C_RESET}" \
  "${__C_RED}" "${fail_count}" "${__C_RESET}" \
  "${total}"
printf 'results: %s\n' "${RESULTS_NDJSON}"

if [ "${fail_count}" -gt 0 ]; then
  printf 'failed:%s\n' "${failed_ids}" >&2
  exit 1
fi
exit 0
