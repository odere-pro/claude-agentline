#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 06: third-party trademark allowlist.
# Spec: §0.2, §11.2
# Pass: every match for a sensitive trademark in shipped artefacts appears
#       in an allowlisted context (e.g., the spec's normative reference to
#       the Claude Code statusline contract).
# Fail: a sensitive trademark appears in a context not in the allowlist
#       (e.g., shipped marketing copy that misuses "Anthropic", "Claude",
#       or "Claude Code").
# Skip: never — runs on every tree, even an empty one.

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

paths_listing="$(shipped_artefact_paths)"

if [ -z "${paths_listing}" ]; then
  pass_gate "no shipped artefacts to scan; trivially clean"
fi

# Build the positional argument list (Bash 3.2 friendly).
set --
while IFS= read -r p; do
  if [ -n "${p}" ]; then
    set -- "$@" "${p}"
  fi
done <<EOF
${paths_listing}
EOF

# Sensitive marks. Word-boundary anchored so we do not flag "claude.ai"
# subdomains, package names containing "claude", or compound identifiers
# like "claude-agentline". The allowlist below is then applied as a second
# pass to drop legitimate uses (the SPEC's reference to "Claude Code's
# statusline contract", attribution lines, etc.).
sensitive='(\bAnthropic\b|\bClaude Code\b|\bClaude\b)'

set +e
raw_matches="$(grep -RInE --binary-files=without-match "${sensitive}" "$@" 2>/dev/null)"
rc=$?
set -e

# `rc=1` ⇒ no matches at all ⇒ pass.
if [ "${rc}" -ne 0 ] || [ -z "${raw_matches}" ]; then
  pass_gate "no sensitive trademark references in shipped artefacts"
fi

# Allowlist: every line matching one of these patterns is acceptable.
# Use ERE alternation; each alternative is anchored on substrings unique
# to a known-good context. The intent is to permit factual references to
# Claude Code as the host runtime (the spec defines agentline as the
# statusline of that runtime), while still flagging bare or marketing-y
# uses of "Claude" or "Anthropic" that could imply endorsement.
allowlist='(Claude Code statusline|Claude Code'\''s statusline|Claude Code reads|Claude Code contract|Claude Code stdin|Claude Code settings|Claude Code'\''s settings|Claude Code state|Claude Code'\''s state|wired into Claude Code|with Claude Code|of Claude Code|to Claude Code|from Claude Code|for Claude Code|for-Claude%20Code|CLAUDE_(CONFIG_DIR|PROJECT_DIR)|honour Claude Code|by Claude Code|Claude Code session|Claude Code version|Claude Code run|Claude Code.*statusLine|Restart Claude Code|Anthropic\b.{0,40}\bnpm|logo=anthropic)'

set +e
disallowed="$(printf '%s\n' "${raw_matches}" | grep -vE "${allowlist}" || true)"
set -e

if [ -n "${disallowed}" ]; then
  log_info "sensitive trademark references not in allowlist:"
  printf '%s\n' "${disallowed}" | sed 's/^/    /' >&2
  log_info "to allow a new context, extend the allowlist regex in tests/gates/gate-06-trademark.sh"
  fail_gate "trademark allowlist violation"
fi

pass_gate "all trademark references match the allowlist"
