#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 17: every §5.5 documented binding appears in `agentline config keys --json`.
# Spec: §5.5, §11.2 G17
# Pass: `agentline config keys --json` exits 0, output is `{ "bindings": [...] }`,
#       every §5.5 action is present, and every entry has the four required
#       fields (key, action, scope, description).
# Fail: command exits non-zero, output is malformed, any §5.5 action is
#       absent, or any entry is missing a required field.
# Skip: `dist/cli.mjs` absent (build not run).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`npm run build\` to activate"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

work_dir="${GATES_TMP_DIR}/gate-17"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

# ── JSON output ──────────────────────────────────────────────────────────────

out_file="${work_dir}/keys.json"
set +e
node "${bin}" config keys --json >"${out_file}" 2>"${work_dir}/stderr.txt"
json_rc=$?
set -e

if [ "${json_rc}" -ne 0 ]; then
  log_info "agentline config keys --json exited ${json_rc}"
  [ -s "${work_dir}/stderr.txt" ] && sed 's/^/    /' "${work_dir}/stderr.txt" >&2
  fail_gate "agentline config keys --json exited non-zero"
fi

if [ ! -s "${out_file}" ]; then
  fail_gate "agentline config keys --json produced no output"
fi

# ── Coverage check via inline Node script ────────────────────────────────────

check_script="${work_dir}/check.mjs"
cat >"${check_script}" <<'NODEJS'
import { readFileSync } from "node:fs";

const raw = readFileSync(process.argv[2], "utf8");

let root;
try {
  root = JSON.parse(raw);
} catch (e) {
  process.stderr.write("output is not valid JSON: " + e.message + "\n");
  process.exit(1);
}

if (!root || typeof root !== "object" || !Array.isArray(root.bindings)) {
  process.stderr.write(
    'expected { "bindings": [...] } wrapper object, got: ' + JSON.stringify(root).slice(0, 80) + "\n",
  );
  process.exit(1);
}

const bindings = root.bindings;

// §5.5 – every documented action id must appear exactly once
const SPEC_ACTIONS = [
  // edit
  "move-cursor",
  "move-cursor-row",
  "move-widget",
  "move-widget-row",
  "add",
  "replace",
  "delete",
  "options",
  "save",
  // picker
  "picker-filter",
  "picker-navigate",
  "picker-confirm",
  "picker-cancel",
  // options sheet
  "toggle-visible",
  "toggle-label",
  "cycle-spacing",
  "options-close",
  // any
  "quit",
  "help",
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
        `binding missing required field '${field}': ${JSON.stringify(b)}\n`,
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

process.stdout.write(`all ${bindings.length} bindings present and well-formed\n`);
NODEJS

set +e
node "${check_script}" "${out_file}" >"${work_dir}/check_out.txt" 2>"${work_dir}/check_err.txt"
check_rc=$?
set -e

if [ "${check_rc}" -ne 0 ]; then
  [ -s "${work_dir}/check_err.txt" ] && sed 's/^/    /' "${work_dir}/check_err.txt" >&2
  fail_gate "keymap coverage check failed"
fi

# ── Human-readable output ────────────────────────────────────────────────────

set +e
node "${bin}" config keys >"${work_dir}/keys_human.txt" 2>/dev/null
human_rc=$?
set -e

if [ "${human_rc}" -ne 0 ]; then
  fail_gate "agentline config keys (table format) exited non-zero"
fi

if [ ! -s "${work_dir}/keys_human.txt" ]; then
  fail_gate "agentline config keys (table format) produced no output"
fi

result_msg="$(cat "${work_dir}/check_out.txt")"
pass_gate "${result_msg}"
