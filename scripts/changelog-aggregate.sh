#!/usr/bin/env bash
# scripts/changelog-aggregate.sh
# Promote fragments under `changelog/` into `CHANGELOG.md`'s `[Unreleased]`
# block, leading each bullet with the short SHA of the commit that
# introduced the fragment. Idempotent against an empty fragment dir.
#
# Usage:
#   bash scripts/changelog-aggregate.sh                     # dry-run; print to stdout
#   bash scripts/changelog-aggregate.sh --apply             # rewrite CHANGELOG.md and
#                                                           # remove the fragments
#   bash scripts/changelog-aggregate.sh --apply \
#     --section Fixed                                       # fold under `### Fixed`
#
# Hard rules:
# - Fragment filenames are anything matching `changelog/*.md` except
#   `README.md`. Each fragment is read top-to-bottom; the first non-empty
#   non-comment line is the bullet body.
# - SHA resolution per fragment:
#     1. If the fragment's first line is `<!-- sha: <sha> -->`, that SHA
#        wins (used by historic backfills committed in a different PR than
#        the one that originally introduced them).
#     2. Otherwise the introducing commit is resolved via
#        `git log -1 --format=%H -- <fragment>`.
#     3. If neither yields a SHA (fragment is uncommitted), the bullet is
#        emitted with `unreleased` as a placeholder so previews still
#        show something useful.
# - Fragments are sorted by introducing commit date (oldest first), with
#   uncommitted fragments appended at the end in lexical order.
# - The aggregator inserts under the `### <section>` heading inside
#   `## [Unreleased]` (`--section`, default `Added`). If that heading is
#   missing it is created at the top of the `[Unreleased]` block — a
#   Fixed-only or Security-only release needs no hand-editing first.
# - On any failure `--apply` leaves CHANGELOG.md and the fragments untouched
#   and removes its own temp files.

set -Eeuo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${THIS_DIR}/.." && pwd)"
FRAGMENTS_DIR="${REPO_ROOT}/changelog"
CHANGELOG="${REPO_ROOT}/CHANGELOG.md"

APPLY=0
SECTION="Added"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    --section)
      shift || true
      SECTION="${1:-}"
      ;;
    --section=*) SECTION="${1#--section=}" ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    "") ;;
    *)
      printf 'changelog-aggregate: unknown option: %s\n' "$1" >&2
      exit 1
      ;;
  esac
  shift || break
done

# The section name is interpolated into an awk program and a Markdown heading;
# keep it to a bare Keep-a-Changelog word so neither can be injected into.
case "${SECTION}" in
  *[!A-Za-z]*|"")
    printf 'changelog-aggregate: invalid --section %s (letters only)\n' "${SECTION}" >&2
    exit 1
    ;;
esac

if [ ! -d "${FRAGMENTS_DIR}" ]; then
  printf 'changelog-aggregate: %s does not exist\n' "${FRAGMENTS_DIR}" >&2
  exit 1
fi
if [ ! -f "${CHANGELOG}" ]; then
  printf 'changelog-aggregate: %s does not exist\n' "${CHANGELOG}" >&2
  exit 1
fi

# Collect fragments, skipping README.md. Plain string list keeps Bash 3.2 happy.
fragments=""
for f in "${FRAGMENTS_DIR}"/*.md; do
  if [ ! -f "${f}" ]; then
    continue
  fi
  base="$(basename "${f}")"
  case "${base}" in
    README.md) continue ;;
  esac
  fragments="${fragments}
${f}"
done
fragments="$(printf '%s' "${fragments}" | sed '/^$/d')"

if [ -z "${fragments}" ]; then
  printf 'changelog-aggregate: no fragments under %s\n' "${FRAGMENTS_DIR}" >&2
  exit 0
fi

# Build "<sortkey>\t<sha>\t<file>" rows, then sort. Committed fragments use
# their commit timestamp; explicit `<!-- sha: ... -->` hints win when present;
# uncommitted fragments use a sentinel that sorts last.
rows=""
while IFS= read -r f; do
  if [ -z "${f}" ]; then
    continue
  fi
  hint_line="$(head -n 1 "${f}" 2>/dev/null || true)"
  case "${hint_line}" in
    "<!-- sha:"*"-->"|"<!-- SHA:"*"-->")
      hint_sha="$(printf '%s' "${hint_line}" \
        | sed -E 's/^[[:space:]]*<!--[[:space:]]*[Ss][Hh][Aa]:[[:space:]]*([0-9a-fA-F]+)[[:space:]]*-->[[:space:]]*$/\1/')"
      ;;
    *)
      hint_sha=""
      ;;
  esac
  if [ -n "${hint_sha}" ]; then
    sha="${hint_sha}"
    ts="$(git -C "${REPO_ROOT}" log -1 --format=%ct "${sha}" 2>/dev/null || true)"
    if [ -z "${ts}" ]; then
      # Hint references a commit git doesn't know about; sort it last but
      # still honour the SHA.
      ts="9999999998"
    fi
  else
    ts="$(git -C "${REPO_ROOT}" log -1 --format=%ct -- "${f}" 2>/dev/null || true)"
    sha="$(git -C "${REPO_ROOT}" log -1 --format=%h -- "${f}" 2>/dev/null || true)"
    if [ -z "${sha}" ]; then
      ts="9999999999"
      sha="unreleased"
    fi
  fi
  rows="${rows}
${ts}	${sha}	${f}"
done <<EOF
${fragments}
EOF
rows="$(printf '%s' "${rows}" | sed '/^$/d' | LC_ALL=C sort)"

# Render bullets.
bullets=""
while IFS=$'\t' read -r _ts sha f; do
  if [ -z "${f}" ]; then
    continue
  fi
  # Strip leading/trailing whitespace and blank lines, drop the optional
  # `<!-- sha: ... -->` hint, then take the first remaining line as the
  # bullet body.
  body="$(sed -e 's/^[[:space:]]\{1,\}//' -e 's/[[:space:]]\{1,\}$//' "${f}" \
    | sed -E '/^[[:space:]]*<!--[[:space:]]*[Ss][Hh][Aa]:[[:space:]]*[0-9a-fA-F]+[[:space:]]*-->[[:space:]]*$/d' \
    | sed '/^$/d' | head -n 1)"
  if [ -z "${body}" ]; then
    printf 'changelog-aggregate: empty fragment: %s\n' "${f}" >&2
    exit 1
  fi
  # Strip a leading "- " if the author wrote one; the aggregator owns the
  # bullet marker.
  body="${body#- }"
  bullets="${bullets}- \`${sha}\` — ${body}
"
done <<EOF
${rows}
EOF

if [ "${APPLY}" -eq 0 ]; then
  printf '%s' "${bullets}"
  exit 0
fi

# --apply path: insert under "### ${SECTION}" inside "## [Unreleased]",
# creating that heading when the block does not already carry it.
#
# awk writes the whole rewritten file before its END rule can fail, so
# `${CHANGELOG}.tmp` exists by the time a failure aborts the script. Trap it
# alongside the bullets file — a leaked tmp gets swept into the release commit
# by `git add -A` (issue #321). The `mv` is the commit point: until it runs,
# CHANGELOG.md and the fragments are untouched.
bullets_file="$(mktemp -t changelog-aggregate.XXXXXX)"
changelog_tmp="${CHANGELOG}.tmp"
trap 'rm -f "${bullets_file}" "${changelog_tmp}"' EXIT
printf '%s' "${bullets}" >"${bullets_file}"

awk -v addfile="${bullets_file}" -v section="${SECTION}" '
  function emit_bullets() {
    while ((getline line < addfile) > 0) {
      print line
    }
    close(addfile)
    inserted = 1
  }
  function emit_section() {
    print "### " section
    print ""
    emit_bullets()
    print ""
  }
  BEGIN {
    in_unrel = 0
    inserted = 0
    seen_unrel = 0
  }
  /^## \[Unreleased\]/ { in_unrel = 1; seen_unrel = 1; print; next }
  /^## \[/ && in_unrel {
    if (!inserted) emit_section()
    in_unrel = 0
  }
  in_unrel && !inserted && $0 == "### " section {
    print
    print ""
    emit_bullets()
    next
  }
  { print }
  END {
    if (in_unrel && !inserted) emit_section()
    if (!seen_unrel) {
      print "changelog-aggregate: no `## [Unreleased]` heading in CHANGELOG.md" \
        > "/dev/stderr"
      exit 1
    }
  }
' "${CHANGELOG}" >"${changelog_tmp}"

mv "${changelog_tmp}" "${CHANGELOG}"

# Remove the consumed fragments. README.md stays.
while IFS=$'\t' read -r _ts _sha f; do
  if [ -n "${f}" ] && [ -f "${f}" ]; then
    rm -- "${f}"
  fi
done <<EOF
${rows}
EOF

printf 'changelog-aggregate: inserted %d bullet(s) into %s\n' \
  "$(printf '%s' "${rows}" | grep -c .)" "${CHANGELOG}"
