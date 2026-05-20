#!/usr/bin/env bash
# tests/gates/lib/glossary.sh
# Shared catalog-count helpers used by gate-20-glossary-check.sh and
# gate-22-glossary-self-consistency.sh. Sourced after lib/common.sh so
# REPO_ROOT and the log_* helpers are already in scope.
#
# Bash 3.2 compatible (macOS default). No associative arrays.

if [ -n "${AGENTLINE_GATES_GLOSSARY_LIB_LOADED:-}" ]; then
  # shellcheck disable=SC2317
  { return 0 2>/dev/null || exit 0; }
fi
AGENTLINE_GATES_GLOSSARY_LIB_LOADED=1

# The catalogue is laid out as one file per family under
# `src/widgets/families/<family>.ts`. Shared helpers (`types.ts`) carry no
# entries and are skipped. An "entry" line looks roughly like:
#     <key>: entry(...
# where <key> is either an unquoted bareword (`model`) or a quoted
# kebab-case string (`"thinking-effort"`).

# Echo the total widget count across all family files.
catalog_total_count() {
  find "${REPO_ROOT}/src/widgets/families" -maxdepth 1 -name '*.ts' \
    -not -name '*.test.ts' -not -name 'types.ts' -print0 2>/dev/null \
    | xargs -0 grep -hcE '^[[:space:]]+("[a-z0-9-]+"|[a-z0-9_-]+):[[:space:]]*entry\(' 2>/dev/null \
    | awk '{s+=$1} END {print s+0}'
}

# Echo the per-family widget count for the named family
# (e.g. `catalog_family_count session`). Echoes `0` when the family file
# is absent.
catalog_family_count() {
  __family="$1"
  __file="${REPO_ROOT}/src/widgets/families/${__family}.ts"
  if [ ! -f "${__file}" ]; then
    printf '0\n'
    return
  fi
  grep -cE '^[[:space:]]+("[a-z0-9-]+"|[a-z0-9_-]+):[[:space:]]*entry\(' "${__file}" 2>/dev/null \
    | awk '{print $1+0}'
}

# Echo every kebab-case widget type found in the catalogue, one per line,
# sorted. Used for catalogue↔glossary parity checks.
catalog_widget_types() {
  find "${REPO_ROOT}/src/widgets/families" -maxdepth 1 -name '*.ts' \
    -not -name '*.test.ts' -not -name 'types.ts' -print0 2>/dev/null \
    | xargs -0 grep -hE '^[[:space:]]+("[a-z0-9-]+"|[a-z0-9_-]+):[[:space:]]*entry\(' 2>/dev/null \
    | sed -E 's/^[[:space:]]+//; s/:[[:space:]]*entry\(.*$//; s/^"([a-z0-9-]+)"$/\1/' \
    | LC_ALL=C sort -u
}
