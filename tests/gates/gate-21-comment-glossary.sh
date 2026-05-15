#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 21: retired glossary terms inside TypeScript source comments.
# Spec: §0.2, §11.2 + docs/GLOSSARY.md "Retired terms".
# Pass: no retired phrase appears inside a `//`, `/* */`, or JSDoc-style
#       `*`-continuation comment line under src/**/*.ts.
# Fail: at least one comment line contains a retired phrase.
# Skip: only when src/ is missing (no TS to scan).
#
# Companion to gate-20-glossary-check.sh, which enforces the same
# vocabulary in docs/, agents/, CLAUDE.md, and README.md. This gate
# covers source-code comments — the surface gate-20 deliberately leaves
# alone.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

SRC_DIR="${REPO_ROOT}/src"

if [ ! -d "${SRC_DIR}" ]; then
  pass_gate "no src/ directory to scan; trivially clean"
fi

# Comment-context anchor. Matches lines that begin with `//`, `/*`, or
# `*` (block-comment continuations and JSDoc `*` continuations). Block
# comments in this repo always carry the leading `*` on continuation
# lines, so this covers every prose-bearing comment line in `src/`.
COMMENT_PREFIX='^[[:space:]]*(//|/\*|\*)'

FAIL=0

check_in_comments() {
  local term_pattern="$1"
  local label="$2"
  local full_pattern="${COMMENT_PREFIX}.*${term_pattern}"
  local hits
  set +e
  hits="$(grep -rnE --include='*.ts' "${full_pattern}" "${SRC_DIR}" 2>/dev/null || true)"
  set -e
  if [ -n "${hits}" ]; then
    log_info "retired glossary term '${label}' inside source comments:"
    printf '%s\n' "${hits}" | sed 's/^/    /' >&2
    FAIL=1
  fi
}

# Retired terms (docs/GLOSSARY.md §"Retired terms").
check_in_comments '\bcategor(y|ies)\b'                           "category (use 'family')"
check_in_comments '\b(init|config|minimal|focus|power) preset\b' "preset (for init configs; use 'config template')"
check_in_comments '\bconfig layer\b'                             "config layer (use 'user config' + 'env override')"
check_in_comments '\boptions sheet\b'                            "options sheet (surface removed)"
check_in_comments '\bagentline init\b'                           "agentline init (use 'agentline install')"
check_in_comments 'agentline config theme'                       "agentline config theme (subcommand retired)"

# Defensive bans mirrored from gate-20 — these are removed assets that
# should also not show up in source comments.
check_in_comments '\bvscode-dark\b'                              "vscode-dark theme (file removed)"
check_in_comments 'agentline\.dev'                               "agentline.dev (placeholder domain)"

if [ "${FAIL}" -eq 1 ]; then
  log_info "to retire a term, update docs/GLOSSARY.md and rewrite the offending comments"
  fail_gate "source comment glossary check failed (see hits above)"
fi

pass_gate "no retired glossary terms in source comments"
