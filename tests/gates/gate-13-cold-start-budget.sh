#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 13: cold-start performance budget.
# Spec: §1.2 N2, §11.2 G13.
# Pass: the bench harness (`scripts/bench/cold-start.mjs`) ran, and
#       p95 ≤ ${AGENTLINE_BENCH_BUDGET_MS:-120}. Or: the bench ran and
#       p95 exceeded budget but `AGENTLINE_BENCH_STRICT` is not set.
# Fail: `AGENTLINE_BENCH_STRICT=1` and p95 exceeds the budget.
# Skip: `dist/cli.mjs` absent, the bench script missing, or `node`
#       unavailable.
#
# CI runners are NOT the §11.1 reference host (2023 MBP M2 / Node 20).
# The gate therefore defaults to informational mode: the numbers are
# always reported in the gate log so regressions can be triaged, but
# only the `AGENTLINE_BENCH_STRICT` opt-in turns over-budget into a
# hard failure. Release engineers who want to enforce the budget at
# tag time set the env var on their workflow / local run.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"
bench="$(repo_path scripts/bench/cold-start.mjs)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`npm run build\` to activate"
fi
if [ ! -f "${bench}" ]; then
  skip_gate "scripts/bench/cold-start.mjs not present yet"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

budget_ms="${AGENTLINE_BENCH_BUDGET_MS:-120}"
samples="${AGENTLINE_BENCH_SAMPLES:-30}"
warmup="${AGENTLINE_BENCH_WARMUP:-3}"
strict="${AGENTLINE_BENCH_STRICT:-0}"

work_dir="${GATES_TMP_DIR}/gate-13"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

result_json="${work_dir}/result.json"
human_log="${work_dir}/result.txt"

set +e
node "${bench}" --json --samples "${samples}" --warmup "${warmup}" \
  >"${result_json}" 2>"${work_dir}/bench.stderr"
rc=$?
set -e

if [ "${rc}" -ne 0 ]; then
  log_info "bench harness failed (rc=${rc})"
  if [ -s "${work_dir}/bench.stderr" ]; then
    sed 's/^/    /' "${work_dir}/bench.stderr" >&2
  fi
  fail_gate "scripts/bench/cold-start.mjs exited non-zero"
fi

if [ ! -s "${result_json}" ]; then
  fail_gate "bench harness produced no output"
fi

# Re-render the JSON as a human-friendly block in the gate log so
# `tests/gates/.tmp/gate-13.log` is useful without an extra parser.
node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(
    "cold-start bench (" + r.samples + " samples, " + r.warmup + " warm-up)\n" +
    "  min:   " + r.minMs.toFixed(2) + " ms\n" +
    "  p50:   " + r.p50Ms.toFixed(2) + " ms\n" +
    "  mean:  " + r.meanMs.toFixed(2) + " ms\n" +
    "  p95:   " + r.p95Ms.toFixed(2) + " ms\n" +
    "  p99:   " + r.p99Ms.toFixed(2) + " ms\n" +
    "  max:   " + r.maxMs.toFixed(2) + " ms\n"
  );
' "${result_json}" >"${human_log}"

p95_ms="$(node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(String(r.p95Ms));
' "${result_json}")"

log_info "$(cat "${human_log}")"
log_info "budget: ${budget_ms} ms p95 (set AGENTLINE_BENCH_BUDGET_MS to override)"
log_info "strict mode: ${strict} (set AGENTLINE_BENCH_STRICT=1 to enforce on this host)"

# Compare p95 against budget. Use awk for portable float comparison
# (Bash 3.2 has no native float arithmetic).
over_budget="$(awk -v p="${p95_ms}" -v b="${budget_ms}" 'BEGIN { print (p > b) ? 1 : 0 }')"

if [ "${over_budget}" -eq 0 ]; then
  pass_gate "cold-start p95 ${p95_ms} ms ≤ ${budget_ms} ms budget"
fi

# Over budget. Strict mode → fail; informational mode → pass with note.
if [ "${strict}" = "1" ]; then
  fail_gate "cold-start p95 ${p95_ms} ms exceeds ${budget_ms} ms budget (strict)"
fi

log_info "p95 ${p95_ms} ms exceeds ${budget_ms} ms budget; not failing because AGENTLINE_BENCH_STRICT is not set"
log_info "this is expected on shared CI runners; reference host is a 2023 MBP M2 / Node 20"
pass_gate "cold-start bench ran (informational; over budget on this host)"
