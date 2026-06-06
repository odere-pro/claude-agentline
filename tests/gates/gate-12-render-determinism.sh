#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 12: render output is byte-identical across two runs and matches expected.ansi.
# Spec: §14, docs/cookbook/14-gates-catalogue.md:66-69
# STRICT: a determinism break is always a failure regardless of CI context.
# Pass: for every scenario under tests/golden/ (containing stdin.json, config.json,
#       clock.txt, expected.ansi), two hermetic runs produce byte-identical stdout
#       and that stdout matches the committed expected.ansi.
# Fail: any scenario produces non-matching bytes between runs, or differs from expected.ansi.
# Skip: dist/cli.mjs absent, node not on PATH, or zero discoverable scenarios.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"
golden_root="$(repo_path tests/golden)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`pnpm run build\` to activate"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

# Discover scenarios: a dir under tests/golden/ is a scenario iff it has all four files.
# Bash 3.2 compatible — no mapfile, no associative arrays.
scenarios=""
if [ -d "${golden_root}" ]; then
  for entry in "${golden_root}"/*/; do
    if [ ! -d "${entry}" ]; then
      continue
    fi
    if [ -f "${entry}stdin.json" ] && \
       [ -f "${entry}config.json" ] && \
       [ -f "${entry}clock.txt" ] && \
       [ -f "${entry}expected.ansi" ]; then
      # Store just the basename; we reconstruct paths below.
      name="$(basename "${entry}")"
      scenarios="${scenarios} ${name}"
    fi
  done
fi

if [ -z "${scenarios}" ]; then
  skip_gate "no discoverable scenarios under tests/golden/ (need stdin.json + config.json + clock.txt + expected.ansi)"
fi

work_root="${GATES_TMP_DIR}/gate-12"
rm -rf "${work_root}"
mkdir -p "${work_root}"

failures=""

# Run a single scenario under a hermetic environment. Mirrors the recording knobs
# pinned in src/render/render/__golden__.test.ts (~lines 65-76):
#   env: { NO_COLOR: "1", AGENTLINE_GLYPHS: "ascii" }, flags: { noColor: true, noUnicode: false },
#   width: 80.
# Redirect stderr to a separate file so stdout bytes are pure ANSI output.
render_scenario() {
  __scenario_dir="$1"
  __out_file="$2"
  __err_file="$3"
  __clock="$(cat "${__scenario_dir}/clock.txt")"
  # shellcheck disable=SC2086
  env -i \
    PATH="${PATH}" \
    HOME="${HOME:-}" \
    NO_COLOR=1 \
    AGENTLINE_GLYPHS=ascii \
    TZ=UTC \
    node "${bin}" render \
      --fixture "${__scenario_dir}/stdin.json" \
      --config "${__scenario_dir}/config.json" \
      --frozen-clock "${__clock}" \
      --width 80 \
      --no-color \
    >"${__out_file}" 2>"${__err_file}"
}

# Iterate in sorted order (LC_ALL=C keeps numeric/alpha stable).
# shellcheck disable=SC2086 # ${scenarios} is intentionally word-split (Bash 3.2 compat list).
sorted_scenarios="$(printf '%s\n' ${scenarios} | LC_ALL=C sort)"

for name in ${sorted_scenarios}; do
  scenario_dir="${golden_root}/${name}"
  work_dir="${work_root}/${name}"
  mkdir -p "${work_dir}"

  run1="${work_dir}/run1.out"
  run2="${work_dir}/run2.out"
  err1="${work_dir}/run1.err"
  err2="${work_dir}/run2.err"
  expected="${scenario_dir}/expected.ansi"

  # Run 1
  set +e
  render_scenario "${scenario_dir}" "${run1}" "${err1}"
  rc1=$?
  set -e

  if [ "${rc1}" -ne 0 ]; then
    log_info "scenario '${name}' run1 stderr:"
    sed 's/^/    /' "${err1}" >&2
    failures="${failures}
  ${name}: run1 exited with rc=${rc1}"
    continue
  fi

  # Run 2
  set +e
  render_scenario "${scenario_dir}" "${run2}" "${err2}"
  rc2=$?
  set -e

  if [ "${rc2}" -ne 0 ]; then
    log_info "scenario '${name}' run2 stderr:"
    sed 's/^/    /' "${err2}" >&2
    failures="${failures}
  ${name}: run2 exited with rc=${rc2}"
    continue
  fi

  # Assertion 1: run1 == run2 (determinism between runs).
  if ! cmp -s "${run1}" "${run2}"; then
    log_info "scenario '${name}': run1 vs run2 differ (non-deterministic output)"
    log_info "run1 bytes:"
    od -c "${run1}" >&2
    log_info "run2 bytes:"
    od -c "${run2}" >&2
    failures="${failures}
  ${name}: run1 != run2 (non-deterministic output)"
    continue
  fi

  # Assertion 2: run1 == expected.ansi (matches committed golden).
  if ! cmp -s "${run1}" "${expected}"; then
    log_info "scenario '${name}': run1 vs expected.ansi differ"
    log_info "run1 bytes:"
    od -c "${run1}" >&2
    log_info "expected.ansi bytes:"
    od -c "${expected}" >&2
    failures="${failures}
  ${name}: run1 != expected.ansi (golden mismatch)"
    continue
  fi

  log_info "scenario '${name}': ok"
done

if [ -n "${failures}" ]; then
  log_info "render determinism failures:${failures}"
  fail_gate "one or more scenarios failed the determinism / golden check"
fi

pass_gate "all scenarios are byte-identical across two runs and match expected.ansi"
