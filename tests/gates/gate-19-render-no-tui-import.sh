#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 19: render-path sources do not statically import Ink, React, or any
# module under `src/tui/`.
# Spec: §1.2 N3 — the render hot path stays light; Ink + React load only
#       when `agentline config` is invoked, via the lazy URL import in
#       `src/cli.ts`. A future top-of-file `import … from "./tui/main.js"`
#       (or `from "ink"`, `from "react"`) in any render-reachable module
#       silently violates the budget; this gate locks that down.
# Pass: every `.ts` file under `src/` except `src/tui/**` is free of static
#       imports of `ink`, `react`, and any `./tui/` / `../tui/` path.
# Fail: a forbidden static import is found.
# Skip: the `src/` tree is missing (running outside the repo).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

src_root="$(repo_path src)"
if [ ! -d "${src_root}" ]; then
  skip_gate "src/ missing; not running inside the repo"
fi

# Collect every .ts file under src/ outside src/tui/. We deliberately keep
# src/tui/*.test.ts in the allowed set (they need ink/react via the testing
# library) by excluding the entire src/tui subtree.
files="$(find "${src_root}" -type f -name '*.ts' -not -path "${src_root}/tui/*" | LC_ALL=C sort)"
if [ -z "${files}" ]; then
  skip_gate "no .ts files outside src/tui/"
fi

# Forbidden static import patterns. Each is a fixed string grep pattern; the
# render path must not name any of these in a top-of-file `import` (or in a
# `require()` call, though the project is ESM-only). `new URL("./tui.mjs", …)`
# in src/cli.ts is a runtime *string*, not a static import, and is allowed.
patterns='from "ink"
from "react"
from "../tui/
from "../../tui/
from "../../../tui/
from "../../../../tui/
from "../../../../../tui/
from "./tui/
require("ink")
require("react")'

violations=""
while IFS= read -r file; do
  while IFS= read -r needle; do
    if grep -nF -- "${needle}" "${file}" >/dev/null 2>&1; then
      hits="$(grep -nF -- "${needle}" "${file}")"
      violations="${violations}
${file}: ${needle}
${hits}"
    fi
  done <<EOF
${patterns}
EOF
done <<EOF
${files}
EOF

if [ -n "${violations}" ]; then
  log_info "forbidden static imports in render-path sources:"
  printf '%s\n' "${violations}" >&2
  fail_gate "render path must not import ink/react/src/tui/* statically — use the lazy URL import in src/cli.ts"
fi

pass_gate "no render-path source imports ink/react/src/tui/ statically"
