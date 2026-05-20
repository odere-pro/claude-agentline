#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 25: layered import direction — `data`, `render`, `widgets`, and `core`
# may not statically import from `src/commands/`. `tui` may, but is excluded
# (the editor is reached only via the lazy URL import out of `src/cli.ts`).
# Spec: src/data/CLAUDE.md ("data imports from core only"),
#       src/render/CLAUDE.md ("render imports from core/data/widgets"),
#       src/core/CLAUDE.md ("core imports only from within core").
# Pass: no `.ts` (or `.tsx`) file under the listed groups imports a
#       `src/commands/...` module via a relative `from "..."` clause.
# Fail: a forbidden static import is found. Logs file:line for every hit.
# Skip: the `src/` tree is missing (running outside the repo).
#
# Why this gate matters: a `data → commands` import re-introduces the
# closed Big Ball of Mud cycle (one verb of the commands layer ends up
# pulled into render-reachable code, blowing the cold-start budget the
# render hot path commits to in docs/cookbook/04-architecture.md).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

src_root="$(repo_path src)"
if [ ! -d "${src_root}" ]; then
  skip_gate "src/ missing; not running inside the repo"
fi

# Layered groups whose import direction is one-way (no upward `commands`
# import). `tui` is excluded — see gate-19 for the editor boundary.
groups="core data render widgets"

violations=""
for group in ${groups}; do
  group_dir="${src_root}/${group}"
  if [ ! -d "${group_dir}" ]; then
    continue
  fi
  # Search every .ts file (including .test.ts — tests live next to the
  # production module, and a test crossing the layer is just as much a
  # boundary leak as the module itself would be).
  files="$(find "${group_dir}" -type f \( -name '*.ts' -o -name '*.tsx' \) | LC_ALL=C sort)"
  if [ -z "${files}" ]; then
    continue
  fi
  while IFS= read -r file; do
    # Match the canonical relative-import shapes a TypeScript module would
    # use to reach into `src/commands/`. Any depth of `../` is caught by
    # the trailing `commands/` substring.
    if grep -nE 'from "(\.\./)+commands/' "${file}" >/dev/null 2>&1; then
      hits="$(grep -nE 'from "(\.\./)+commands/' "${file}")"
      violations="${violations}
${file}
${hits}"
    fi
  done <<EOF
${files}
EOF
done

if [ -n "${violations}" ]; then
  log_info "forbidden static imports of src/commands/ from layered groups (core/data/render/widgets):"
  printf '%s\n' "${violations}" >&2
  fail_gate "layered groups must not import from src/commands/ — move shared utilities into src/core/lib/ instead"
fi

pass_gate "no core/data/render/widgets source imports src/commands/ statically"
