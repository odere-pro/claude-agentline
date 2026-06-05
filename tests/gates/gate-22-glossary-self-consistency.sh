#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 22: glossary self-consistency.
# Spec: docs/GLOSSARY.md + tests/gates/lib/glossary.sh
# Pass: every count, table row, and type-path the glossary claims still
#       matches the code it documents.
# Fail: any drift.
# Skip: never.
#
# Companion to gate-20-glossary-check.sh (banned terms in docs) and
# gate-21-comment-glossary.sh (banned terms in source comments). This
# gate is what catches the glossary itself drifting from the code.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"
# shellcheck source=lib/glossary.sh
. "$(dirname "$0")/lib/glossary.sh"

GLOSSARY="${REPO_ROOT}/docs/GLOSSARY.md"
FAIL=0

fail_check() {
  log_fail "$(gate_self_id): $*"
  FAIL=1
}

if [ ! -f "${GLOSSARY}" ]; then
  fail_gate "glossary not found at docs/GLOSSARY.md"
fi

# ── 1. Total widget count in the glossary heading == catalog total ───────────

claimed_total=$(grep -oE '^## Built-in widget types \([0-9]+ total\)' "${GLOSSARY}" \
  | grep -oE '[0-9]+' | head -1 || true)
actual_total=$(catalog_total_count)

if [ -z "${claimed_total}" ]; then
  fail_check "glossary missing '## Built-in widget types (N total)' heading"
elif [ "${claimed_total}" != "${actual_total}" ]; then
  fail_check "glossary heading says ${claimed_total} widgets, catalog has ${actual_total}"
fi

# ── 2. Per-family heading counts == per-family catalog counts ────────────────
#
# Each family heading looks like:  ### Session family (6)
# The kebab `rate-limits` family is rendered title-cased in the glossary as
# "Rate-limits family"; map both directions.

check_family() {
  __family="$1"     # kebab-case file basename
  __heading="$2"    # how it appears in the glossary heading
  __claimed=$(grep -oE "^### ${__heading} family \([0-9]+\)" "${GLOSSARY}" \
    | grep -oE '[0-9]+' | head -1 || true)
  __actual=$(catalog_family_count "${__family}")
  if [ -z "${__claimed}" ]; then
    fail_check "glossary missing '### ${__heading} family (N)' heading"
    return
  fi
  if [ "${__claimed}" != "${__actual}" ]; then
    fail_check "glossary '${__heading} family (${__claimed})' but catalog has ${__actual}"
  fi
}

check_family session     Session
check_family tokens      Tokens
check_family context     Context
check_family rate-limits Rate-limits
check_family git         Git

# ── 3. No stale gate count claim ─────────────────────────────────────────────
#
# The glossary used to say "Currently N gates ship". Now it doesn't carry
# an integer count at all — gate-22 enforces that.

if grep -qE 'Currently [0-9]+ gates? ship' "${GLOSSARY}"; then
  fail_check "glossary still claims a literal gate count — remove or auto-derive"
fi

# ── 4. TypeScript types table file paths exist + contain the export ──────────
#
# Each row looks like:
#   | `TypeName`  | `src/path/file.ts`  | description |
# We accept any of: `export type|interface|class|const|function TypeName`.
# Re-exports (`export type { TypeName } from "…"`) do NOT count — the
# table must point to the canonical declaration.

extract_type_table() {
  awk '
    /^## TypeScript types/ { in_table = 1; next }
    in_table && /^## / { in_table = 0 }
    in_table && /^\| `/ {
      # Skip header rows (the `Type` heading + separator).
      if ($0 ~ /^\| `Type`/) next
      print
    }
  ' "${GLOSSARY}"
}

while IFS= read -r row; do
  [ -z "${row}" ] && continue
  type_name=$(printf '%s' "${row}" | awk -F'`' '{print $2}')
  type_path=$(printf '%s' "${row}" | awk -F'`' '{print $4}')
  [ -z "${type_name}" ] && continue
  [ -z "${type_path}" ] && continue

  if [ ! -f "${REPO_ROOT}/${type_path}" ]; then
    fail_check "type-table row '${type_name}' points to missing file '${type_path}'"
    continue
  fi
  if ! grep -qE "^export (type|interface|class|const|function) ${type_name}\b" \
       "${REPO_ROOT}/${type_path}"; then
    actual=$(grep -rlnE "^export (type|interface|class|const|function) ${type_name}\b" \
             "${REPO_ROOT}/src" --include='*.ts' 2>/dev/null \
             | head -1 | sed "s|^${REPO_ROOT}/||")
    fail_check "type-table row '${type_name}' claims '${type_path}' but the declaration is in '${actual:-not found}'"
  fi
done < <(extract_type_table)

# ── 5. Widget rows in the glossary ↔ catalog parity ──────────────────────────
#
# Every kebab-case widget type listed in a glossary table appears in
# `src/widgets/families/<family>.ts`, and vice versa.

claimed_types_file="${GATES_TMP_DIR}/gate-22-glossary-types.txt"
actual_types_file="${GATES_TMP_DIR}/gate-22-catalog-types.txt"

# Glossary widget tables: extract every `| \`<kebab-case>\` |` cell that
# sits inside a family table. The family tables live between
# `## Built-in widget types …` and the next `---` divider.
awk '
  /^## Built-in widget types/ { in_section = 1; next }
  in_section && /^## / && !/^## Built-in widget types/ { in_section = 0 }
  in_section && /^\| `[a-z0-9-]+` *\|/ {
    # Skip the row separator and header by requiring a backtick-delimited cell.
    if (match($0, /`[a-z0-9-]+`/)) {
      tok = substr($0, RSTART + 1, RLENGTH - 2)
      print tok
    }
  }
' "${GLOSSARY}" | LC_ALL=C sort -u > "${claimed_types_file}"

catalog_widget_types > "${actual_types_file}"

# Only kebab-case (contains a `-`) widget types appear in family tables.
# Bare-word types like `model`, `plan`, `version`, `tokens` are listed
# without backticks in some prose-style cells; allow either to be missing
# from the strict "claimed" set, but flag any type the *glossary* lists
# that the catalog does not.
missing_in_catalog=$(comm -23 "${claimed_types_file}" "${actual_types_file}" 2>/dev/null || true)
if [ -n "${missing_in_catalog}" ]; then
  while IFS= read -r missing; do
    [ -z "${missing}" ] && continue
    fail_check "glossary lists widget '${missing}' but the catalog has no such entry"
  done <<EOF
${missing_in_catalog}
EOF
fi

# ── 6. Surface-map counts (opt-in — marker must be present to be checked) ────
#
# SOFTWARE-3-0.md may declare counts using HTML-comment markers on one line:
#   <!-- agentline:count name="<key>" -->INTEGER<!-- /agentline:count -->
#
# Keys and their derivers:
#   agents-skills  →  agents_skill_count()
#   claude-md      →  claude_md_count()
#
# If a marker is absent the check is silently skipped (opt-in contract).
# If a marker is present its integer must equal the derived value.

SOFTWARE3="${REPO_ROOT}/SOFTWARE-3-0.md"

check_surface_count() {
  __key="$1"
  __derived="$2"
  if [ ! -f "${SOFTWARE3}" ]; then
    return
  fi
  __doc_val=$(grep -oE \
    "<!-- agentline:count name=\"${__key}\" -->[0-9]+<!-- /agentline:count -->" \
    "${SOFTWARE3}" \
    | grep -oE '[0-9]+' | head -1 || true)
  if [ -z "${__doc_val}" ]; then
    return
  fi
  if [ "${__doc_val}" != "${__derived}" ]; then
    fail_check "surface-map count '${__key}' says ${__doc_val}, code has ${__derived}"
  fi
}

check_surface_count "agents-skills" "$(agents_skill_count)"
check_surface_count "claude-md"     "$(claude_md_count)"

# ── Result ───────────────────────────────────────────────────────────────────

if [ "${FAIL}" -eq 1 ]; then
  fail_gate "glossary self-consistency check failed (see errors above)"
fi

pass_gate "${actual_total} widgets · family counts aligned · type-table paths verified · no stale gate count · surface-map counts verified"
