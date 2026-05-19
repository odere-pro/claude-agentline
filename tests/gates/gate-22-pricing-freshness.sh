#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 22: the embedded pricing table is not stale.
# Spec: §8.5 — `PRICING_TABLE_VERSION` is refreshed by maintainers as part
#       of releases. No widget consumes pricing at runtime, so freshness is
#       a maintainer/CI concern and is NOT surfaced by `agentline doctor`
#       (the old D06 check was retired). This gate is the local + PR signal
#       that the scheduled `pricing-skew.yml` workflow alone cannot give.
# Pass: `PRICING_TABLE_VERSION` parses as YYYY-MM-DD and is within
#       `PRICING_FRESH_MAX_DAYS` (defaulting to 90 if the constant is absent).
# Fail: the version literal is missing/malformed, or older than the budget.
# Skip: `src/data/tokens/pricing.ts` is missing (running outside the repo).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

pricing_file="$(repo_path src/data/tokens/pricing.ts)"
if [ ! -f "${pricing_file}" ]; then
  skip_gate "src/data/tokens/pricing.ts missing; not running inside the repo"
fi

if ! have_cmd node; then
  skip_gate "node not on PATH"
fi

# Regex-parse the two literals out of the static module — no tsc/tsup
# round-trip just to read a date and a number. Mirrors the parse approach
# in .github/workflows/pricing-skew.yml for consistency. node exits 0 and
# prints "<age> <version> <threshold>" when fresh; non-zero with a stderr
# message otherwise.
if out="$(
  PRICING_FILE="${pricing_file}" node -e '
    const fs = require("fs");
    const src = fs.readFileSync(process.env.PRICING_FILE, "utf8");
    const vm = src.match(/PRICING_TABLE_VERSION\s*=\s*"(\d{4}-\d{2}-\d{2})"/);
    if (!vm) {
      process.stderr.write("PRICING_TABLE_VERSION literal not found\n");
      process.exit(1);
    }
    const version = vm[1];
    const ts = Date.parse(version + "T00:00:00Z");
    if (Number.isNaN(ts)) {
      process.stderr.write("PRICING_TABLE_VERSION=\"" + version + "\" is not a valid calendar date\n");
      process.exit(1);
    }
    const tm = src.match(/PRICING_FRESH_MAX_DAYS\s*=\s*(\d+)/);
    const threshold = tm ? Number(tm[1]) : 90;
    const age = Math.max(0, Math.floor((Date.now() - ts) / 86400000));
    if (age > threshold) {
      process.stderr.write("pricing table dated " + version + " is " + age + "d old (threshold " + threshold + ")\n");
      process.exit(1);
    }
    process.stdout.write("dated " + version + " (" + age + "d old, threshold " + threshold + ")\n");
  ' 2>&1
)"; then
  pass_gate "pricing table ${out}"
else
  log_info "${out}"
  fail_gate "embedded pricing table stale or unparseable — refresh src/data/tokens/pricing.ts and bump PRICING_TABLE_VERSION"
fi
