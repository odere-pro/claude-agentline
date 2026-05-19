#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 17: every §5.5 documented action is represented in the compiled
# keymap registry (`dist/keys.mjs` re-exports DEFAULT_KEY_BINDINGS).
# Spec: §5.5, §11.2 G17
# Pass: every §5.5 action is present, every entry has the four required
#       fields (key, action, scope, description), and action ids are unique.
# Fail: any §5.5 action is absent, any entry is missing a required field,
#       or any action id is duplicated.
# Skip: `dist/keys.mjs` absent (build not run) or node missing.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/keys.mjs)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/keys.mjs not built; run \`npm run build\` to activate"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

work_dir="${GATES_TMP_DIR}/gate-17"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

# Import via a relative path so the spec works identically on Linux, macOS,
# and Windows. MSYS-style absolute paths (e.g. `/d/a/...`) confuse the
# Node ESM resolver on Windows, which treats them as drive-rooted paths
# (`D:\d\a\...`) and fails with ERR_MODULE_NOT_FOUND. The work_dir layout
# is fixed: tests/gates/.tmp/gate-17/check.mjs → ../../../../dist/keys.mjs.
check_script="${work_dir}/check.mjs"
cat >"${check_script}" <<NODEJS
import { DEFAULT_KEY_BINDINGS } from "../../../../dist/keys.mjs";

const bindings = DEFAULT_KEY_BINDINGS;

if (!Array.isArray(bindings)) {
  process.stderr.write("DEFAULT_KEY_BINDINGS is not an array\n");
  process.exit(1);
}

// §5.5 – every documented action id must appear exactly once
const SPEC_ACTIONS = [
  // edit
  "move-cursor",
  "move-cursor-row",
  "move-widget",
  "move-widget-row",
  "edit-widget",
  "add",
  "replace",
  "delete",
  "save",
  // picker (three steps share one scope)
  "picker-filter",
  "picker-navigate",
  "picker-confirm",
  "picker-back",
  // any
  "quit",
];

const presentActions = new Set(bindings.map((b) => b.action));
const missing = SPEC_ACTIONS.filter((a) => !presentActions.has(a));
if (missing.length > 0) {
  process.stderr.write("missing bindings for actions: " + missing.join(", ") + "\n");
  process.exit(1);
}

// Every entry must have the four required string fields
for (const b of bindings) {
  for (const field of ["key", "action", "scope", "description"]) {
    if (typeof b[field] !== "string" || b[field].length === 0) {
      process.stderr.write(
        \`binding missing required field '\${field}': \${JSON.stringify(b)}\n\`,
      );
      process.exit(1);
    }
  }
}

// Action ids must be unique
const seen = new Set();
for (const b of bindings) {
  if (seen.has(b.action)) {
    process.stderr.write("duplicate action id: " + b.action + "\n");
    process.exit(1);
  }
  seen.add(b.action);
}

process.stdout.write(\`all \${bindings.length} bindings present and well-formed\n\`);
NODEJS

set +e
node "${check_script}" >"${work_dir}/check_out.txt" 2>"${work_dir}/check_err.txt"
check_rc=$?
set -e

if [ "${check_rc}" -ne 0 ]; then
  [ -s "${work_dir}/check_err.txt" ] && sed 's/^/    /' "${work_dir}/check_err.txt" >&2
  fail_gate "keymap coverage check failed"
fi

result_msg="$(cat "${work_dir}/check_out.txt")"
pass_gate "${result_msg}"
