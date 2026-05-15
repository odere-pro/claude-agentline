#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 20: Glossary consistency
# Spec: docs/GLOSSARY.md
# Pass: all invariants hold — README widget count matches the catalog,
#       docs/themes.md mentions every shipped theme and no retired ones,
#       banned/retired terms are absent from user-facing docs and agents,
#       no duplicate changelog fragment numbers, schema $id domains parity.
# Fail: any invariant violated.
# Skip: never.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

FAIL=0

fail_check() {
  log_fail "$(gate_self_id): $*"
  FAIL=1
}

# ── 1. Widget count in README.md matches the catalog ────────────────────────
#
# The catalog lives under src/widgets/catalog/<family>.ts (one file per family).
# Each widget entry is a line shaped roughly like:
#     <key>: entry(...
# where <key> is either an unquoted bareword (e.g. `model`) or a quoted
# kebab-case string (e.g. `"thinking-effort"`). The regex below matches both.

catalog_count=$(
  find "${REPO_ROOT}/src/widgets/catalog" -maxdepth 1 -name '*.ts' \
    -not -name '*.test.ts' -not -name 'types.ts' -print0 2>/dev/null \
    | xargs -0 grep -hcE '^[[:space:]]+("[a-z0-9-]+"|[a-z0-9_-]+):[[:space:]]*entry\(' 2>/dev/null \
    | awk '{s+=$1} END {print s+0}'
)

readme_count=$(grep -oE '\*\*[0-9]+ widgets\*\*' "${REPO_ROOT}/README.md" \
  | head -1 | grep -oE '[0-9]+' || true)

if [ -n "${readme_count}" ] && [ "${readme_count}" != "${catalog_count}" ]; then
  fail_check "README.md says '${readme_count} widgets' but catalog has ${catalog_count} entries"
fi

# docs/get-started.md must not reference the long-retired count of 55.
if grep -qE '\b55 (available |)widget' "${REPO_ROOT}/docs/get-started.md" 2>/dev/null; then
  fail_check "docs/get-started.md still references 55 widgets (should be ${catalog_count})"
fi

# ── 2. Theme list in docs/themes.md matches the themes/ directory ────────────

theme_files=$(find "${REPO_ROOT}/themes" -maxdepth 1 -name '*.json' -print0 2>/dev/null \
  | xargs -0 -I{} basename {} .json | LC_ALL=C sort)
theme_count=$(printf '%s\n' "${theme_files}" | grep -c . || true)

while IFS= read -r theme_name; do
  [ -z "${theme_name}" ] && continue
  if ! grep -q "${theme_name}" "${REPO_ROOT}/docs/themes.md" 2>/dev/null; then
    fail_check "docs/themes.md does not mention shipped theme '${theme_name}'"
  fi
done <<EOF
${theme_files}
EOF

# Retired theme names that must not reappear as shipping claims. These are
# tolerated as naming-convention examples elsewhere, but not in docs/themes.md.
for stale_theme in github-light solarized dracula; do
  if grep -qw "${stale_theme}" "${REPO_ROOT}/docs/themes.md" 2>/dev/null; then
    fail_check "docs/themes.md references removed theme '${stale_theme}'"
  fi
done

# ── 3. Banned terms absent from docs, agents, CLAUDE.md, README.md ───────────

SCAN_PATHS=(
  "${REPO_ROOT}/docs"
  "${REPO_ROOT}/agents"
  "${REPO_ROOT}/CLAUDE.md"
  "${REPO_ROOT}/README.md"
)

check_banned() {
  local pattern="$1"
  local label="$2"
  for p in "${SCAN_PATHS[@]}"; do
    [ -e "${p}" ] || continue
    local result
    result=$(grep -rln --include='*.md' -E "${pattern}" "${p}" 2>/dev/null || true)
    if [ -n "${result}" ]; then
      fail_check "banned pattern '${label}' found in: ${result}"
    fi
  done
}

check_banned "55 available widget"     "55 available widgets (stale count)"
check_banned "minimal preset"          "minimal preset (retired config template)"
check_banned "config theme --show"     "agentline config theme --show (retired command)"
check_banned 'vscode-dark\.json'       "vscode-dark.json (removed theme file)"
check_banned '\bagentline\.dev\b'      "agentline.dev placeholder domain"

# ── 4. "category" not used as the user-facing family term in docs/agents ─────
#
# Source comments are covered by gate-21-comment-glossary.sh.
# docs/GLOSSARY.md documents the retired alias and is exempted, as is
# CLAUDE.md if it explicitly describes the rename history.

for path in "${REPO_ROOT}/docs" "${REPO_ROOT}/agents"; do
  [ -e "${path}" ] || continue
  while IFS= read -r found_file; do
    [ -z "${found_file}" ] && continue
    [ "${found_file}" = "${REPO_ROOT}/docs/GLOSSARY.md" ] && continue
    fail_check "'category' used as user-facing grouping term in: ${found_file} (use 'family' instead)"
  done < <(
    grep -rlE '\bcategor(y|ies)\b' "${path}" --include='*.md' 2>/dev/null \
      | grep -v 'GLOSSARY\.md' || true
  )
done

# ── 5. No duplicate changelog fragment numbers ───────────────────────────────

dupes=$(
  find "${REPO_ROOT}/changelog" -maxdepth 1 -name '[0-9]*-*.md' -print0 2>/dev/null \
    | xargs -0 -I{} basename {} \
    | sed -E 's/^([0-9]+)-.*/\1/' \
    | LC_ALL=C sort \
    | uniq -d
)
if [ -n "${dupes}" ]; then
  fail_check "duplicate changelog fragment number(s): ${dupes}"
fi

# ── 6. Schema $id domains are consistent across sibling schemas ──────────────

config_domain=$(grep -oE '"[$]id"[[:space:]]*:[[:space:]]*"https://[^/]+' \
  "${REPO_ROOT}/schemas/config.schema.json" 2>/dev/null \
  | grep -oE 'https://[^/]+' || true)
theme_domain=$(grep -oE '"[$]id"[[:space:]]*:[[:space:]]*"https://[^/]+' \
  "${REPO_ROOT}/schemas/theme.schema.json" 2>/dev/null \
  | grep -oE 'https://[^/]+' || true)

if [ -n "${config_domain}" ] && [ -n "${theme_domain}" ] \
   && [ "${config_domain}" != "${theme_domain}" ]; then
  fail_check "schema \$id domain mismatch: config='${config_domain}' theme='${theme_domain}'"
fi

# ── Result ───────────────────────────────────────────────────────────────────

if [ "${FAIL}" -eq 1 ]; then
  fail_gate "glossary consistency check failed (see errors above)"
fi

pass_gate "${catalog_count} widgets · ${theme_count} shipped theme(s) · no banned terms · no duplicate fragments · schema domains aligned"
