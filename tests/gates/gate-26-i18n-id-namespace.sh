#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 26: i18n id namespace coverage + dictionary source-of-truth.
# Spec: docs/GLOSSARY.md (vocabulary) + src/core/i18n/ids.ts (contract)
#       + src/core/i18n/en-dictionary.ts (authored English).
# Pass: (a) every literal id passed to a translator call starts with a
#       prefix declared in `I18N_NAMESPACES`; (b) every dictionary-form
#       call (one quoted arg, with or without a `{ vars }` object) uses
#       an id that is a key in `EN_DICTIONARY`; (c) every key in
#       `EN_DICTIONARY` starts with a registered prefix; (d) for every
#       literal-en form (two quoted args), the literal en either equals
#       `EN_DICTIONARY[id]` or the id is absent from the dictionary; (e)
#       no id appears with two different literal-en fallbacks.
# Fail: any of the above.
# Skip: only when `src/` is missing.
#
# Companion to gate-21-comment-glossary.sh (banned terms in comments).
# Catches the silent bug class where a typo in an id silently falls back
# to the literal English text, and the related drift where the
# dictionary loses its source-of-truth role.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

SRC_DIR="${REPO_ROOT}/src"
IDS_FILE="${SRC_DIR}/core/i18n/ids.ts"
DICT_FILE="${SRC_DIR}/core/i18n/en-dictionary.ts"

if [ ! -d "${SRC_DIR}" ]; then
  pass_gate "no src/ directory to scan; trivially clean"
fi
if [ ! -f "${IDS_FILE}" ]; then
  fail_gate "src/core/i18n/ids.ts not found; cannot resolve I18N_NAMESPACES"
fi
if [ ! -f "${DICT_FILE}" ]; then
  fail_gate "src/core/i18n/en-dictionary.ts not found; cannot resolve EN_DICTIONARY"
fi

# ── Parse I18N_NAMESPACES ──────────────────────────────────────────────────
PREFIXES=$(
  awk '
    /export const I18N_NAMESPACES/ { open = 1 }
    open {
      while (match($0, /"[a-z]+\."/)) {
        print substr($0, RSTART + 1, RLENGTH - 2)
        $0 = substr($0, RSTART + RLENGTH)
      }
      if (index($0, "]")) { open = 0 }
    }
  ' "${IDS_FILE}" | LC_ALL=C sort -u
)
if [ -z "${PREFIXES}" ]; then
  fail_gate "could not parse I18N_NAMESPACES from src/core/i18n/ids.ts"
fi
PREFIX_LIST=$(printf '%s' "${PREFIXES}" | tr '\n' ' ')
log_info "registered namespaces: ${PREFIX_LIST}"

matches_prefix() {
  __id="$1"
  for __p in ${PREFIXES}; do
    case "${__id}" in
      "${__p}"*) return 0 ;;
    esac
  done
  return 1
}

# ── Parse EN_DICTIONARY ────────────────────────────────────────────────────
#
# Dictionary values may span two lines for readability (prettier breaks
# long lines after the `:`). We join a continuation line onto the entry
# whenever the key line ends with `:` and no value follows on the same
# line.

DICT_TABLE="${GATES_TMP_DIR}/gate-26-dict.tsv"

awk '
  # State machine: NORMAL reads key lines; BACKTICK reads a multi-line
  # template-literal value until the closing backtick. Once we have a
  # (key, value) pair we emit "id<TAB>value" with newlines collapsed to
  # spaces (gate-26 does not need value fidelity, only that the key is
  # present and the value is non-empty for the literal-en check).
  BEGIN { state = "NORMAL"; cur_id = ""; cur_val = "" }

  state == "BACKTICK" {
    # Look for the closing backtick.
    if (match($0, /`/)) {
      cur_val = cur_val " " substr($0, 1, RSTART - 1)
      gsub(/\n/, " ", cur_val); gsub(/  +/, " ", cur_val)
      sub(/^ /, "", cur_val)
      print cur_id "\t" cur_val
      state = "NORMAL"; cur_id = ""; cur_val = ""
    } else {
      cur_val = cur_val " " $0
    }
    next
  }

  # NORMAL — looking for an entry line.
  /^  "[a-z][a-z0-9.-]*":/ {
    if (!match($0, /"[a-z][a-z0-9.-]*"/)) next
    id_tok = substr($0, RSTART, RLENGTH)
    id = substr(id_tok, 2, length(id_tok) - 2)
    tail = substr($0, RSTART + RLENGTH)
    sub(/^[[:space:]]*:[[:space:]]*/, "", tail)

    # Same-line double-quoted value.
    if (match(tail, /^"[^"]*"/)) {
      en_tok = substr(tail, RSTART, RLENGTH)
      print id "\t" substr(en_tok, 2, length(en_tok) - 2)
      next
    }
    # Same-line backtick value, possibly multi-line.
    if (match(tail, /^`/)) {
      after = substr(tail, RSTART + 1)
      if (match(after, /`/)) {
        # Closes on the same line.
        print id "\t" substr(after, 1, RSTART - 1)
        next
      }
      cur_id = id; cur_val = after; state = "BACKTICK"
      next
    }
    # Value missing on this line — must be on the next line (prettier wrap).
    if ((getline next_line) > 0) {
      sub(/^[[:space:]]+/, "", next_line)
      if (match(next_line, /^"[^"]*"/)) {
        en_tok = substr(next_line, RSTART, RLENGTH)
        print id "\t" substr(en_tok, 2, length(en_tok) - 2)
      } else if (match(next_line, /^`/)) {
        after = substr(next_line, RSTART + 1)
        if (match(after, /`/)) {
          print id "\t" substr(after, 1, RSTART - 1)
        } else {
          cur_id = id; cur_val = after; state = "BACKTICK"
        }
      }
    }
  }
' "${DICT_FILE}" | LC_ALL=C sort > "${DICT_TABLE}"

if [ ! -s "${DICT_TABLE}" ]; then
  fail_gate "could not parse EN_DICTIONARY entries from src/core/i18n/en-dictionary.ts"
fi

dict_count=$(wc -l < "${DICT_TABLE}" | awk '{print $1+0}')

FAIL=0

# (c) Every EN_DICTIONARY key starts with a registered prefix.
while IFS=$'\t' read -r id _en; do
  [ -z "${id}" ] && continue
  if ! matches_prefix "${id}"; then
    log_info "EN_DICTIONARY key '${id}' does not match any registered prefix"
    FAIL=1
  fi
done < "${DICT_TABLE}"

DICT_KEYS="${GATES_TMP_DIR}/gate-26-dict-keys.txt"
awk -F'\t' '{print $1}' "${DICT_TABLE}" > "${DICT_KEYS}"

dict_lookup_en() {
  awk -F'\t' -v id="$1" '$1 == id { print $2; exit }' "${DICT_TABLE}"
}

dict_has_key() {
  grep -qxF "$1" "${DICT_KEYS}"
}

# ── Scan call sites ────────────────────────────────────────────────────────
#
# A "translator call" is any source-text shape `…t(<quoted-id>…)` where
# `t` is preceded by either a `.` (method call, e.g. `ctx.t(`) or any
# non-identifier char (free function, e.g. `t(`). Also catches the
# explicit `td(` form. The first argument is always a quoted id; the
# second (when present and also a quoted literal) is the English
# fallback used by the lower-level `Translator` form.

CALL_PATTERN='(^|[^[:alnum:]_])t(d)?\((["'\''`])[^"'\''`]+\3'

HITS_FILE="${GATES_TMP_DIR}/gate-26-hits.txt"
grep -rnE --include='*.ts' --exclude='*.test.ts' --exclude='*.spec.ts' \
  "${CALL_PATTERN}" "${SRC_DIR}" 2>/dev/null > "${HITS_FILE}" || true

# Per-call parser: given the slice of a line at-or-after the `t(`/`td(`,
# emit either:
#   D<TAB>id          — dictionary form (one quoted arg)
#   L<TAB>id<TAB>en   — literal-en form (two quoted args)
parse_call() {
  awk '
    {
      # Locate the function name. Match `t(` or `td(` preceded by
      # something that is NOT an identifier char (start-of-line, `.`,
      # `(`, ` `, etc.).
      n = length($0)
      idx = 0
      fnlen = 0
      for (i = 1; i <= n - 1; i++) {
        c = substr($0, i, 1)
        if (c ~ /[A-Za-z0-9_]/) continue
        # candidate boundary at position i; check (i+1..) for t( or td(
        if (substr($0, i + 1, 3) == "td(") {
          idx = i + 1; fnlen = 3; break
        } else if (substr($0, i + 1, 2) == "t(") {
          idx = i + 1; fnlen = 2; break
        }
      }
      if (idx == 0) {
        # also handle the case where the line begins with t(/td(
        if (substr($0, 1, 3) == "td(") { idx = 1; fnlen = 3 }
        else if (substr($0, 1, 2) == "t(")  { idx = 1; fnlen = 2 }
        else next
      }
      tail = substr($0, idx + fnlen)
      # First quoted arg: id.
      if (match(tail, /^"[^"]*"/) ||
          match(tail, /^'\''[^'\'']*'\''/) ||
          match(tail, /^`[^`]*`/)) {
        id_tok = substr(tail, RSTART, RLENGTH)
        rest_after = substr(tail, RSTART + RLENGTH)
      } else { next }
      id = substr(id_tok, 2, length(id_tok) - 2)
      # Is there a comma + second quoted arg?
      tmp = rest_after
      sub(/^[[:space:]]*,[[:space:]]*/, "", tmp)
      if (tmp != rest_after) {
        if (match(tmp, /^"[^"]*"/) ||
            match(tmp, /^'\''[^'\'']*'\''/) ||
            match(tmp, /^`[^`]*`/)) {
          en_tok = substr(tmp, RSTART, RLENGTH)
          en = substr(en_tok, 2, length(en_tok) - 2)
          print "L\t" id "\t" en
          next
        }
      }
      print "D\t" id
    }
  '
}

T_IDS_FOUND="${GATES_TMP_DIR}/gate-26-t-ids.tsv"
: > "${T_IDS_FOUND}"

dict_calls=0
literal_calls=0

while IFS= read -r hit; do
  [ -z "${hit}" ] && continue
  file=$(printf '%s' "${hit}" | awk -F':' '{print $1}')
  line=$(printf '%s' "${hit}" | awk -F':' '{print $2}')
  rest=$(printf '%s' "${hit}" | cut -d':' -f3-)
  parsed=$(printf '%s\n' "${rest}" | parse_call)
  [ -z "${parsed}" ] && continue
  rel=${file#"${REPO_ROOT}/"}
  kind=$(printf '%s' "${parsed}" | awk -F'\t' '{print $1}')
  id=$(printf '%s' "${parsed}" | awk -F'\t' '{print $2}')

  # shellcheck disable=SC2016 # the literal `${` characters detect template-literal id syntax in source
  case "${id}" in
    *'${'*)
      static_prefix="${id%%\$\{*}"
      if ! matches_prefix "${static_prefix}"; then
        log_info "${rel}:${line}  id='${id}'  reason='template-literal prefix ${static_prefix} not in I18N_NAMESPACES'"
        FAIL=1
      fi
      continue
      ;;
  esac

  if ! matches_prefix "${id}"; then
    log_info "${rel}:${line}  id='${id}'  reason='no registered prefix matches'"
    FAIL=1
    continue
  fi

  if [ "${kind}" = "D" ]; then
    dict_calls=$((dict_calls + 1))
    if ! dict_has_key "${id}"; then
      log_info "${rel}:${line}  id='${id}'  reason='dictionary-form call but id is not a key in EN_DICTIONARY'"
      FAIL=1
    fi
  else
    literal_calls=$((literal_calls + 1))
    en=$(printf '%s' "${parsed}" | awk -F'\t' '{print $3}')
    if dict_has_key "${id}"; then
      expected=$(dict_lookup_en "${id}")
      if [ "${en}" != "${expected}" ]; then
        log_info "${rel}:${line}  id='${id}'  reason='literal-en differs from EN_DICTIONARY — switch to dict form or sync the dictionary'"
        FAIL=1
      fi
    fi
    printf '%s\t%s\t%s:%s\n' "${id}" "${en}" "${file}" "${line}" >> "${T_IDS_FOUND}"
  fi
done < "${HITS_FILE}"

# (e) — duplicate-fallback detection for literal-en form
if [ -s "${T_IDS_FOUND}" ]; then
  dupes=$(
    awk -F'\t' '{
      id = $1; en = $2; loc = $3
      if (id in seen && seen[id] != en) {
        print id "\t" seen[id] "\t" seenloc[id]
        print id "\t" en       "\t" loc
      } else {
        seen[id] = en
        seenloc[id] = loc
      }
    }' "${T_IDS_FOUND}" | LC_ALL=C sort -u
  )
  if [ -n "${dupes}" ]; then
    while IFS=$'\t' read -r d_id d_en d_loc; do
      [ -z "${d_id}" ] && continue
      rel=${d_loc#"${REPO_ROOT}/"}
      log_info "duplicate fallback for '${d_id}': '${d_en}' at ${rel}"
    done <<EOF
${dupes}
EOF
    FAIL=1
  fi
fi

if [ "${FAIL}" -eq 1 ]; then
  log_info "fix the id (typo?), update the dictionary, or extend I18N_NAMESPACES in src/core/i18n/ids.ts"
  fail_gate "i18n id namespace check failed (see hits above)"
fi

pass_gate "${dict_count} dictionary entries · ${dict_calls} dict-form + ${literal_calls} literal-en call sites · namespaces: ${PREFIX_LIST% }"
