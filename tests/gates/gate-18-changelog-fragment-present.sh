#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 18: every PR with a non-doc change adds a `changelog/` fragment.
# Spec: repo housekeeping (per `changelog/README.md` and `docs/plan/PR-CONVENTIONS.md`).
# Pass: the diff against the merge base contains no non-doc changes, OR
#       it adds at least one new file under `changelog/<NN>-<slug>.md`.
# Fail: non-doc changes are present but no new fragment was added.
# Skip: not in a git working tree, on the base branch itself, or no
#       reachable merge base (shallow checkout without the base ref).
#
# Doc-only paths (no fragment required):
#   - changelog/         (the fragment dir itself; non-add changes still count as doc-only)
#   - CHANGELOG.md       (release-time aggregation)
#   - README.md
#   - docs/
#   - .github/
#   - LICENSE / CODE_OF_CONDUCT.md / SECURITY.md / SUPPORT.md / CONTRIBUTING.md
#   - the PR-CONVENTIONS / PR-PLAN / SPEC under docs/plan are already covered by docs/

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

if ! have_cmd git; then
  skip_gate "git not available on PATH"
fi

# Must be inside a git work tree.
if ! git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  skip_gate "not inside a git work tree"
fi

# Resolve the comparison base. Order of preference:
#   1. $GATE_BASE_REF       (manual override — useful for local testing)
#   2. $GITHUB_BASE_REF     (set by GitHub Actions on pull_request events)
#   3. origin/main          (default CI checkout configuration)
#   4. main                 (local dev without an origin)
base_ref=""
for candidate in \
  "${GATE_BASE_REF:-}" \
  "${GITHUB_BASE_REF:+origin/${GITHUB_BASE_REF}}" \
  "origin/main" \
  "main"; do
  if [ -z "${candidate}" ]; then
    continue
  fi
  if git -C "${REPO_ROOT}" rev-parse --verify --quiet "${candidate}" >/dev/null 2>&1; then
    base_ref="${candidate}"
    break
  fi
done

if [ -z "${base_ref}" ]; then
  skip_gate "no base ref reachable (shallow checkout? run \`git fetch origin main\`)"
fi

head_sha="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
base_sha="$(git -C "${REPO_ROOT}" rev-parse "${base_ref}")"

# On the base branch itself there is no diff to enforce.
if [ "${head_sha}" = "${base_sha}" ]; then
  skip_gate "HEAD is the base ref (${base_ref}); nothing to enforce"
fi

# `A...B` (three dots) gives the symmetric merge base — the diff that the
# PR would apply, ignoring upstream commits made after the branch was cut.
merge_base="$(git -C "${REPO_ROOT}" merge-base "${base_ref}" HEAD 2>/dev/null || true)"
if [ -z "${merge_base}" ]; then
  skip_gate "no merge base between HEAD and ${base_ref}"
fi

work_dir="${GATES_TMP_DIR}/gate-18"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

# Two name listings:
#   - all_changes:    every path in the diff (any status).
#   - added_changes:  paths newly added (-A in --diff-filter), used to
#                     check whether the PR adds a fragment.
all_changes_file="${work_dir}/all-changes.txt"
added_changes_file="${work_dir}/added-changes.txt"

git -C "${REPO_ROOT}" diff --name-only "${merge_base}...HEAD" >"${all_changes_file}"
git -C "${REPO_ROOT}" diff --name-only --diff-filter=A "${merge_base}...HEAD" >"${added_changes_file}"

if [ ! -s "${all_changes_file}" ]; then
  pass_gate "diff is empty against ${base_ref}"
fi

# Doc-only filter. Anything matching one of these prefixes/files is
# treated as not-requiring a fragment.
is_doc_only() {
  __p="$1"
  case "${__p}" in
    changelog/* ) return 0 ;;
    docs/*      ) return 0 ;;
    .github/*   ) return 0 ;;
    README.md             ) return 0 ;;
    CHANGELOG.md          ) return 0 ;;
    LICENSE               ) return 0 ;;
    CODE_OF_CONDUCT.md    ) return 0 ;;
    SECURITY.md           ) return 0 ;;
    SUPPORT.md            ) return 0 ;;
    CONTRIBUTING.md       ) return 0 ;;
    CLAUDE.md             ) return 0 ;;
  esac
  return 1
}

non_doc_count=0
non_doc_sample=""
while IFS= read -r p; do
  if [ -z "${p}" ]; then
    continue
  fi
  if is_doc_only "${p}"; then
    continue
  fi
  non_doc_count=$((non_doc_count + 1))
  if [ -z "${non_doc_sample}" ]; then
    non_doc_sample="${p}"
  fi
done <"${all_changes_file}"

if [ "${non_doc_count}" -eq 0 ]; then
  pass_gate "diff is doc-only against ${base_ref}; no fragment required"
fi

# Non-doc changes present — require a freshly added fragment.
fragment_added=0
while IFS= read -r p; do
  case "${p}" in
    changelog/*.md)
      # Ignore the README under changelog/.
      if [ "${p}" != "changelog/README.md" ]; then
        fragment_added=1
        break
      fi
      ;;
  esac
done <"${added_changes_file}"

if [ "${fragment_added}" -eq 1 ]; then
  pass_gate "fragment added; ${non_doc_count} non-doc path(s) covered (e.g. ${non_doc_sample})"
fi

log_info "non-doc changes against ${base_ref} (showing up to 10):"
grep -v -E '^(changelog/|docs/|\.github/|README\.md$|CHANGELOG\.md$|LICENSE$|CODE_OF_CONDUCT\.md$|SECURITY\.md$|SUPPORT\.md$|CONTRIBUTING\.md$|CLAUDE\.md$)' \
  "${all_changes_file}" | head -10 | sed 's/^/    /' >&2
log_info "expected: a new file under changelog/<NN>-<slug>.md (see changelog/README.md)"
fail_gate "non-doc changes present but no changelog fragment was added"
