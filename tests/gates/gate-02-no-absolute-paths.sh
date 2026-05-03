#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 02: no `/Users/`, `/home/`, or `~/.claude/` literals in shipped artefacts.
# Spec: §1.2 N6, §11.2
# Pass: none of the forbidden literals appears in any path returned by
#       shipped_artefact_paths().
# Fail: at least one literal appears in a shipped path.
# Skip: never — the gate runs on every tree, even an empty one (no shipped
#       paths means trivially clean).
#
# Repo metadata that does not enter the published tarball (CLAUDE.md,
# CONTRIBUTING.md, docs/, tests/, tmp/, .git/, .github/) is intentionally
# out of scope.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

paths_listing="$(shipped_artefact_paths)"

if [ -z "${paths_listing}" ]; then
  pass_gate "no shipped artefacts to scan; trivially clean"
fi

# Build positional arguments from the listing without using arrays-of-paths
# beyond the for-loop (Bash 3.2 friendly).
set --
while IFS= read -r p; do
  if [ -n "${p}" ]; then
    set -- "$@" "${p}"
  fi
done <<EOF
${paths_listing}
EOF

# Forbidden literal alternation. Anchored on the literal characters; we do
# not want to match e.g. "/Users-Service/" or in-word substrings.
pattern='(/Users/|/home/|~/\.claude/)'

set +e
matches="$(grep -RInE --binary-files=without-match "${pattern}" "$@" 2>/dev/null)"
rc=$?
set -e

# grep exits 1 when there are no matches; that is the success path here.
if [ "${rc}" -eq 0 ] && [ -n "${matches}" ]; then
  log_info "forbidden literals found in shipped artefacts:"
  printf '%s\n' "${matches}" | sed 's/^/    /' >&2
  fail_gate "remove absolute-path literals before shipping"
fi

pass_gate "no forbidden absolute-path literals in shipped artefacts"
