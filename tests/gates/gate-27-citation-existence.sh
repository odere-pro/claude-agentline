#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 27: citation existence check.
# Spec: docs/cookbook/14-gates-catalogue.md §27
# Pass: every repo-path / path:line / gate-id / md-link citation found in the
#       scope set resolves on disk (existence check only, not line accuracy).
# Fail: at least one citation resolves to a missing path.
# Skip: never.
#
# SCOPE SET:
#   find docs -name '*.md'   (every doc; count derived at run time, never hardcoded)
#   ./CLAUDE.md
#   ./SOFTWARE-3-0.md
# Explicitly EXCLUDED: per-group src/**/CLAUDE.md (not end-user docs).
#
# CITATION FORMS CHECKED:
#   1. Backtick repo path  — `src/foo/bar.ts` or `src/foo/`
#   2. path:line or path:line:col — same path rules, strip from first colon
#   3. Bare gate-id — gate-NN resolves if tests/gates/gate-NN-*.sh exists OR
#      docs/cookbook/14-gates-catalogue.md defines it (^#{1,4} gate-NN heading)
#   4. Markdown link [text](target) — target starts with a known root dir
#
# EXCLUSIONS (false-positive suppression):
#   - Paths with internal whitespace (kills command-line fragments)
#   - Placeholder tokens: < > { } * in the path
#   - Template version patterns: vX.Y.Z (capital X)
#   - Template sequence patterns: -NN- in the path
#   - Environment variables: ${VAR} or $VAR prefix
#   - http(s):// URLs and ~/… host paths
#   - Extension-less prose nouns and bare .txt (no extension and no trailing /,
#     or .txt suffix) — false-positive risk too high; out of scope by design
#
# Performance: one xargs grep -oH per citation form across all scope files,
# then all filtering in awk (no per-token subprocesses). sort -u before the
# [ -e ] check. Well under 250ms over the 39-file scope set.
#
# Mode: STRICT, skip-never (gate-20/gate-22 pattern).
# Accumulate all failures, report with source file, then fail_gate once.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

# ── Fixture override — for TDD synthetic fixture tests only ─────────────────
#
# When GATE27_FIXTURE_DIR is set, the gate scans that directory tree instead
# of REPO_ROOT for both scope assembly and existence checks. GATES_TMP_DIR
# still comes from common.sh (real repo scratch). Normal gate runs leave this
# variable unset; the fixture test script sets it to a synthetic mini-repo.

GATE27_ROOT="${GATE27_FIXTURE_DIR:-${REPO_ROOT}}"

# ── Scope assembly — widen here when new top-level doc trees are added ───────
#
# Hard-coded list so widening is one line.

CITATION_DOC_ROOTS=(
  docs
  CLAUDE.md
  SOFTWARE-3-0.md
)

FAIL=0

fail_check() {
  log_fail "$(gate_self_id): $*"
  FAIL=1
}

# ── Build scope file list ────────────────────────────────────────────────────

SCOPE_LIST_FILE="${GATES_TMP_DIR}/gate-27-scope.txt"
: > "${SCOPE_LIST_FILE}"

for _root in "${CITATION_DOC_ROOTS[@]}"; do
  _full="${GATE27_ROOT}/${_root}"
  if [ -d "${_full}" ]; then
    find "${_full}" -name '*.md' >> "${SCOPE_LIST_FILE}"
  elif [ -f "${_full}" ]; then
    printf '%s\n' "${_full}" >> "${SCOPE_LIST_FILE}"
  fi
done

if [ ! -s "${SCOPE_LIST_FILE}" ]; then
  fail_gate "no scope files found"
fi

scope_count=$(wc -l < "${SCOPE_LIST_FILE}" | tr -d ' ')
log_info "scope: ${scope_count} file(s)"

# ── Shared awk filter program (embedded, no tempfile) ───────────────────────
#
# Accepts "fullpath:token" (grep -oH output) and emits "token TAB source".
# All exclusion and shape checks run in awk — zero per-token forks.
# Note: "close" is a reserved awk keyword; we use "cend" for closing index.

# shellcheck disable=SC2016
AWK_PATH_FILTER='
function bad(s) {
  return (s ~ /[[:space:]]/ || s ~ /[<>{}*]/ || s ~ /vX\./ ||
          s ~ /-NN-/ || s ~ /^\$/ || s ~ /^http/ || s ~ /^~\//)
}
function repo_shape(s) {
  if (!(s ~ /^(src|docs|tests|schemas|templates|themes|scripts|agents|changelog)\//)) return 0
  if (s ~ /\.(ts|tsx|js|mjs|cjs|json|md|sh|sb|yml|yaml|toml|lock)$/ || s ~ /\/$/) return 1
  return 0
}
{
  # Form: /abs/path/file.md:`token`  (grep -oH output with surrounding backticks)
  # Find the ":`" separator to split source from token.
  sep = index($0, ":`")
  if (sep == 0) next
  src = substr($0, 1, sep - 1)
  tok_raw = substr($0, sep + 2, length($0) - sep - 2)  # strip surrounding backticks
  # Strip GATE27_ROOT prefix from source for display.
  if (index(src, root) == 1) src = substr(src, length(root) + 1)
  # Strip :line or :line:col suffix — path check only.
  colon = index(tok_raw, ":")
  if (colon > 0) tok = substr(tok_raw, 1, colon - 1)
  else tok = tok_raw
  if (bad(tok)) next
  if (!repo_shape(tok)) next
  print tok "\t" src
}
'

# shellcheck disable=SC2016
AWK_GATE_FILTER='
{
  # Form: /abs/path/file.md:gate-NN  (grep -oH, first colon separates path)
  colon = index($0, ":")
  if (colon == 0) next
  src = substr($0, 1, colon - 1)
  gate_id = substr($0, colon + 1)
  if (index(src, root) == 1) src = substr(src, length(root) + 1)
  # Exclude -NN- placeholder forms.
  if (gate_id ~ /-NN-/) next
  print "GATE\t" gate_id "\t" src
}
'

# shellcheck disable=SC2016
AWK_LINK_FILTER='
function bad(s) {
  return (s ~ /[[:space:]]/ || s ~ /[<>{}*]/ || s ~ /vX\./ ||
          s ~ /-NN-/ || s ~ /^\$/ || s ~ /^http/ || s ~ /^#/ || s ~ /^~\//)
}
function repo_shape(s) {
  if (!(s ~ /^(src|docs|tests|schemas|templates|themes|scripts|agents|changelog)\//)) return 0
  if (s ~ /\.(ts|tsx|js|mjs|cjs|json|md|sh|sb|yml|yaml|toml|lock)$/ || s ~ /\/$/) return 1
  return 0
}
{
  # Form: /abs/path/file.md:[text](target)
  colon = index($0, ":")
  if (colon == 0) next
  src = substr($0, 1, colon - 1)
  rest = substr($0, colon + 1)
  if (index(src, root) == 1) src = substr(src, length(root) + 1)
  # Extract target from [text](target): find the last ( and ).
  opar = index(rest, "(")
  if (opar == 0) next
  # Find the matching ) after the (
  cend = index(substr(rest, opar + 1), ")")
  if (cend == 0) next
  target = substr(rest, opar + 1, cend - 1)
  if (bad(target)) next
  if (!repo_shape(target)) next
  print target "\t" src
}
'

# ── Candidate extraction (one xargs grep -oH pass per form) ─────────────────
#
# xargs passes all scope files to a single grep invocation — one process per
# form, not one per file. The awk filter runs once on the concatenated output.
# "|| true" on xargs prevents set -e from aborting when grep finds no matches.

RAW_CANDIDATES="${GATES_TMP_DIR}/gate-27-raw.txt"
: > "${RAW_CANDIDATES}"

# Forms 1 & 2: backtick-quoted tokens.
# SC2016: backtick literals in the regex are intentional — not variable expansion.
# shellcheck disable=SC2016
xargs grep -oHE '`[^`]+`' < "${SCOPE_LIST_FILE}" 2>/dev/null | \
  awk -v root="${GATE27_ROOT}/" "${AWK_PATH_FILTER}" >> "${RAW_CANDIDATES}" || true

# Form 3: bare gate-id tokens (prose + tables, not restricted to backticks).
xargs grep -oHE 'gate-[0-9][0-9]' < "${SCOPE_LIST_FILE}" 2>/dev/null | \
  awk -v root="${GATE27_ROOT}/" "${AWK_GATE_FILTER}" >> "${RAW_CANDIDATES}" || true

# Form 4: markdown link targets [text](target).
xargs grep -oHE '\[[^]]*\]\([^)]+\)' < "${SCOPE_LIST_FILE}" 2>/dev/null | \
  awk -v root="${GATE27_ROOT}/" "${AWK_LINK_FILTER}" >> "${RAW_CANDIDATES}" || true

# ── Deduplicate: sort -u by path/gate column, keep one representative source ─

PATH_CANDIDATES="${GATES_TMP_DIR}/gate-27-paths.txt"
GATE_CANDIDATES="${GATES_TMP_DIR}/gate-27-gates.txt"

# "|| true" when one class of row is absent from the raw file.
grep -v '^GATE	' "${RAW_CANDIDATES}" 2>/dev/null | LC_ALL=C sort -u -k1,1 > "${PATH_CANDIDATES}" || true
grep    '^GATE	' "${RAW_CANDIDATES}" 2>/dev/null | LC_ALL=C sort -u -k2,2 > "${GATE_CANDIDATES}" || true

total_checked=0

# ── Existence check: regular path citations ─────────────────────────────────

while IFS='	' read -r _path _src; do
  [ -z "${_path}" ] && continue
  total_checked=$((total_checked + 1))
  if [ ! -e "${GATE27_ROOT}/${_path}" ]; then
    fail_check "dangling citation '${_path}' in ${_src}"
  fi
done < "${PATH_CANDIDATES}"

# ── Existence check: gate-NN citations ──────────────────────────────────────
#
# A cited gate-NN resolves if EITHER:
#   (a) tests/gates/gate-NN-*.sh exists (implemented gate), OR
#   (b) docs/cookbook/14-gates-catalogue.md defines it via a heading
#       matching ^#{1,4}\s*gate-NN\b (spec-level gate, not yet implemented).
#
# A gate-id that satisfies neither (e.g. a typo'd gate-99) fails.
# The catalogue is read once and its defined gate-NN set held in a file.

CATALOGUE="${GATE27_ROOT}/docs/cookbook/14-gates-catalogue.md"
CATALOGUE_GATES="${GATES_TMP_DIR}/gate-27-catalogue-gates.txt"
: > "${CATALOGUE_GATES}"

if [ -f "${CATALOGUE}" ]; then
  # Extract gate-NN tokens from heading lines (^#{1,4} gate-NN).
  # grep -oE: emit only the gate-NN portion of each match.
  grep -oE '^#{1,4}[[:space:]]+gate-[0-9][0-9]' "${CATALOGUE}" 2>/dev/null | \
    grep -oE 'gate-[0-9][0-9]' >> "${CATALOGUE_GATES}" || true
fi

# is_gate_defined: returns 0 if gate_id is in catalogue set, 1 otherwise.
# Uses grep on the pre-built file — one fast lookup, no subshell per gate.
is_gate_defined() {
  grep -qxF "$1" "${CATALOGUE_GATES}" 2>/dev/null
}

while IFS='	' read -r _tag _gate_id _src; do
  [ -z "${_gate_id}" ] && continue
  total_checked=$((total_checked + 1))
  # Check (a): implemented script exists.
  _found=""
  set +e
  _found=$(find "${GATE27_ROOT}/tests/gates" -maxdepth 1 -name "${_gate_id}-*.sh" 2>/dev/null | head -1)
  set -e
  if [ -n "${_found}" ]; then
    continue
  fi
  # Check (b): catalogue-defined (spec-level, not yet implemented).
  if is_gate_defined "${_gate_id}"; then
    continue
  fi
  fail_check "dangling gate citation '${_gate_id}' (no script and not in catalogue) in ${_src}"
done < "${GATE_CANDIDATES}"

# ── Result ───────────────────────────────────────────────────────────────────

if [ "${FAIL}" -eq 1 ]; then
  fail_gate "citation existence check failed (see errors above)"
fi

pass_gate "${total_checked} citation(s) checked, all resolve"
