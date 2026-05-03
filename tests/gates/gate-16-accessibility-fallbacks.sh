#!/usr/bin/env bash
set -Eeuo pipefail

# Gate 16: accessibility flags strip the bytes they advertise.
# Spec: §1.2 N8, §11.2 G16
# Pass: against a fixed payload, the render path emits non-empty output
#       under each of `--no-color`, `--no-unicode`, `--ascii` (and
#       `NO_COLOR=1`); each flagged output drops the corresponding
#       category of bytes (ANSI escape sequences, non-ASCII bytes, or
#       both); and at least one of the four variants actually changes
#       the output relative to the un-flagged baseline.
# Fail: a flag advertised in §5.4 leaves banned bytes in the output.
# Skip: `dist/cli.mjs` absent, or every flag produces the same bytes as
#       the baseline (the producer has not wired the flag table yet).

# shellcheck source=lib/common.sh
. "$(dirname "$0")/lib/common.sh"

bin="$(repo_path dist/cli.mjs)"

if [ ! -f "${bin}" ]; then
  skip_gate "dist/cli.mjs not built; run \`npm run build\` to activate"
fi
if ! have_cmd node; then
  skip_gate "node not available on PATH"
fi

work_dir="${GATES_TMP_DIR}/gate-16"
rm -rf "${work_dir}"
mkdir -p "${work_dir}"

fixture="${work_dir}/payload.json"
cat >"${fixture}" <<'JSON'
{
  "model": "sonnet-4.6",
  "version": "0.0.0",
  "outputStyle": "default",
  "sessionId": "11111111-1111-1111-1111-111111111111",
  "sessionName": "gate-16",
  "cwd": "/tmp/agentline-gate-16",
  "thinkingEffort": "medium",
  "vimMode": "off"
}
JSON

# Render against a hermetic environment so colour heuristics behave the
# same way each invocation. `FORCE_COLOR=1` opts in to colour even though
# the pipe target is not a TTY; the renderer is then expected to honour
# the accessibility flags on top of that opt-in.
render() {
  __out_file="$1"
  __extra_env="$2"
  shift 2
  # shellcheck disable=SC2086 # __extra_env is intentionally word-split.
  env -i \
    PATH="${PATH}" \
    HOME="${HOME:-}" \
    FORCE_COLOR=1 \
    ${__extra_env} \
    node "${bin}" "$@" \
    <"${fixture}" \
    >"${__out_file}" 2>"${__out_file}.stderr"
}

baseline="${work_dir}/baseline.out"
no_color_flag="${work_dir}/no-color.out"
no_unicode_flag="${work_dir}/no-unicode.out"
ascii_flag="${work_dir}/ascii.out"
no_color_env="${work_dir}/no-color-env.out"

set +e
render "${baseline}"        ""
rc_baseline=$?
render "${no_color_flag}"   "" --no-color
rc_no_color=$?
render "${no_unicode_flag}" "" --no-unicode
rc_no_unicode=$?
render "${ascii_flag}"      "" --ascii
rc_ascii=$?
render "${no_color_env}"    "NO_COLOR=1"
rc_env=$?
set -e

for combo in \
    "baseline:${rc_baseline}" \
    "--no-color:${rc_no_color}" \
    "--no-unicode:${rc_no_unicode}" \
    "--ascii:${rc_ascii}" \
    "NO_COLOR=1:${rc_env}"; do
  __label="${combo%:*}"
  __rc="${combo##*:}"
  if [ "${__rc}" -ne 0 ]; then
    log_info "${__label} stderr:"
    sed 's/^/    /' "${work_dir}/$(basename "${__label}").out.stderr" 2>/dev/null >&2 || true
    fail_gate "${__label} render exited with rc=${__rc}"
  fi
done

for f in "${baseline}" "${no_color_flag}" "${no_unicode_flag}" "${ascii_flag}" "${no_color_env}"; do
  if [ ! -s "${f}" ]; then
    fail_gate "render produced empty output for $(basename "${f}")"
  fi
done

# Detect ANSI CSI sequences (ESC [ …).
contains_ansi() {
  LC_ALL=C grep -aq $'\x1b\\[' "$1"
}
# Detect any non-ASCII byte (≥ 0x80). Prefer `grep -P`; fall back to a
# pure-POSIX `tr` pipeline on hosts (BusyBox, some Solaris) where Perl
# regex is unavailable.
contains_non_ascii() {
  LC_ALL=C grep -aPq '[\x80-\xff]' "$1" 2>/dev/null
}
if ! printf 'a' | LC_ALL=C grep -aPq '[\x80-\xff]' 2>/dev/null; then
  contains_non_ascii() {
    __n="$(LC_ALL=C tr -d '\000-\177' <"$1" | LC_ALL=C wc -c | tr -d ' ')"
    [ "${__n}" -gt 0 ]
  }
fi

# If every variant matches the baseline byte-for-byte, the producer has
# not wired the flag table yet. Skip rather than fail — the gate is
# dormant until §5.4 is implemented.
if cmp -s "${baseline}" "${no_color_flag}" \
   && cmp -s "${baseline}" "${no_unicode_flag}" \
   && cmp -s "${baseline}" "${ascii_flag}" \
   && cmp -s "${baseline}" "${no_color_env}"; then
  skip_gate "no accessibility flag changed output; producer not wired yet"
fi

failures=""

assert_no_ansi() {
  __flag="$1"
  __file="$2"
  if contains_ansi "${__file}"; then
    failures="${failures}
  ${__flag} output still contains ANSI escape sequences"
  fi
}

assert_no_non_ascii() {
  __flag="$1"
  __file="$2"
  if contains_non_ascii "${__file}"; then
    failures="${failures}
  ${__flag} output still contains non-ASCII bytes"
  fi
}

assert_no_ansi      "--no-color"   "${no_color_flag}"
assert_no_ansi      "NO_COLOR=1"   "${no_color_env}"
assert_no_non_ascii "--no-unicode" "${no_unicode_flag}"
assert_no_ansi      "--ascii"      "${ascii_flag}"
assert_no_non_ascii "--ascii"      "${ascii_flag}"

if [ -n "${failures}" ]; then
  log_info "accessibility violations:${failures}"
  fail_gate "one or more accessibility flags left banned bytes in the output"
fi

pass_gate "accessibility flags strip the bytes they advertise"
