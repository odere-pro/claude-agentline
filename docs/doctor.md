# Doctor

`agentline doctor` is the host-health check. It runs all eleven checks
in order, prints an aligned status table, and exits 0 when nothing needs
your attention.

```bash
agentline doctor          # report (TTY: coloured glyphs; pipe: plain ASCII)
agentline doctor --fix    # report + repair the auto-fixable checks
agentline doctor --json   # machine-readable output (no formatter)
agentline doctor --strict # warnings exit non-zero (use in CI)
```

Titles pad to a uniform column width so messages line up across rows.
Glyphs (`[ok]` / `[!!]` / `[XX]` / `[fx]` / `[--]`) colourise on a
TTY; piped output stays plain ASCII so it greps cleanly. Set
`NO_COLOR=1` to suppress colour even on a TTY. When fail/warn rows
mention `--fix`, the formatter appends a `next: agentline doctor
--fix` line naming how many checks would be repaired.

Reporting and repair are deliberately separate code paths: without
`--fix`, doctor will not mutate your host. The `scripts/doctor.sh`
wrapper around the bin is read-only by construction — it never passes
`--fix` for you.

## Checks

| ID  | Check                                                                                           | Auto-fix                                                                 |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| D01 | `~/.claude/settings.json` exists                                                                | create with default skeleton                                             |
| D02 | `statusLine.command` resolves to a working `agentline` invocation                               | rewrite to `npx -y @odere-pro/agentline` or the absolute global bin path |
| D03 | user config exists and matches schema                                                           | migrate or write defaults                                                |
| D04 | every theme referenced by config is installed                                                   | copy from the package's embedded theme set                               |
| D05 | git binary on PATH when any git widget is enabled                                               | none; reports                                                            |
| D06 | the resolved global config directory is writable (or creatable)                                 | none; reports                                                            |
| D07 | update-check cache (read-only) reports a newer release                                          | none; reports                                                            |
| D08 | render dry-run on an embedded fixture matches the stored snapshot                               | none; reports                                                            |
| D09 | `~/.claude/settings.json` `statusLine.refreshInterval` matches the configured `refreshInterval` | re-sync from config                                                      |
| D10 | Claude CLI health (read-only): update available and `claude doctor` issues/warnings             | none; reports                                                            |
| D11 | Widget config sanity: unknown/removed types and `git-pr` without `allowNetwork` opt-in          | none; reports                                                            |

`--fix` touches D01–D04 and D09. Everything else is reported and left
to you, on the principle that doctor never acts on host state it does
not own.

### D01 — settings file

Verifies `~/.claude/settings.json` is present and parseable JSON. With
`--fix`, writes the minimal skeleton:

```json
{ "statusLine": null }
```

so that D02 can populate the `statusLine` entry on the next run.

### D02 — statusLine wiring

Verifies `settings.json` contains a `statusLine` entry whose `command`
resolves to an `agentline` binary **that still exists and is
executable** at run time. This catches the orphaned-bin failure mode
where a user removed the global package (`npm uninstall -g
@odere-pro/agentline`, `npm unlink`, prefix change) without running
`agentline uninstall` — Claude Code keeps painting the last cached
render until the wiring is repaired. With `--fix`, writes:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y @odere-pro/agentline"
  }
}
```

When a global install of `@odere-pro/agentline` is detected on PATH, the
absolute path of that bin is preferred over `npx` (faster cold-start).
Existing user values that point at agentline are upgraded in place;
foreign values are left alone unless you also pass `--force` to the
install script.

### D03 — user config

Validates the merged config against the embedded schema. With `--fix`:

- if no user config exists, writes `templates/default.config.json` to
  the user config path;
- if the schema version is older than current, runs the migration and
  writes a `.bak` sibling with the previous bytes;
- if the schema version is **newer** than current, refuses to mutate —
  exits with code 2 and a structured error so an old binary cannot
  silently downgrade a newer file.

### D04 — themes

Verifies every theme referenced by the merged config is installed in
the user themes directory. With `--fix`, copies the missing themes
from the package's bundled set; user-edited themes are never
overwritten.

### D05 — git binary

Triggered only when at least one `git-*` widget is enabled. Reports
whether `git` is on PATH and whether the working directory is a
checkout. No fix.

### D06 — config directory writable

agentline is configured globally only; the single write target is
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline`. D06 always probes that
resolved directory — there is no skipped path, because the bin always
has a config home regardless of whether `CLAUDE_CONFIG_DIR` is set. If
the directory already exists it must be a writable directory; if it
does not exist yet (fresh install) the nearest existing ancestor must
be writable so config and themes can be created. Reports `warn` when
the target is not writable or not creatable. No fix.

### D07 — update check

Reads the cached npm-registry probe (refreshed by `agentline install`
and `agentline edit`). Surfaces a hint when a newer `@odere-pro/agentline`
is available. Never fetches from inside the check; a missing or
unreachable cache is reported as `pass`. No fix.

### D08 — render snapshot

Runs the renderer against an embedded fixture and compares the output
against a stored snapshot. Detects regressions in the render hot path
without depending on a live Claude Code session. No fix.

### D09 — refresh interval

Compares `~/.claude/settings.json` `statusLine.refreshInterval` against
agentline's configured `refreshInterval` (default `5` seconds; see
[config.md](./config.md)). Passes when the configured value is `0` and
the settings field is absent, or when the field is present and equal.
Warns on a mismatch, or when the field is missing while a non-zero
interval is configured. With `--fix`, re-syncs the settings field from
config — writing the interval through, or removing the field when the
configured value is `0`.

### D10 — Claude CLI health

Reports on the host `claude` CLI from an off-render-path cache: whether a
newer Claude Code CLI is available, and the issue/warning counts from
`claude doctor`. Read-only — like D07 it never spawns `claude` or fetches
from inside the check. The cache is refreshed lazily by the live render
path (the first `agentline` render, and once per ~24h thereafter, spawns a
detached probe). A `claude doctor` failure reports `fail`; a warning reports
`warn`; an available update or a clean, current CLI reports `pass` (an
update hint is informational). A missing CLI or an unpopulated cache reports
`pass` with an explanation. No fix.

### D11 — Widget config sanity

Advisory check (severity `warn`, never `fail`) that surfaces widgets which
are configured but will not render:

1. **Unknown or removed widget types.** Any `type` in the configured widget
   list that is absent from the widget catalogue renders as a hidden cell
   with no visible feedback. This catches the common post-upgrade scenario
   where an old config still names a type that was removed (e.g. the eight
   types removed in v0.3.0: `claude-doctor`, `claude-update`, `context-bar`,
   `context-length`, `git-sha`, `git-untracked`, `current-session-reset-at`,
   `weekly-reset-at`). Reports each unknown type and suggests `agentline edit`
   to remove or replace them.

2. **`git-pr` without the network opt-in.** A `git-pr` widget whose
   `options.allowNetwork` is not explicitly `true` will never show a PR
   number — the resolver skips the network call without the opt-in. Reports
   the widget and tells the user to set `options.allowNetwork: true` (noting
   the latency and privacy cost).

Source of truth for valid types is the widget catalogue (`WIDGET_CATALOG`),
not a hardcoded list, so D11 stays accurate as the widget set evolves.
Returns `pass` with a count when every widget is renderable. No fix.

## Output formats

### Text

```text
[ok] D01 settings.json present — at /home/u/.claude/settings.json
[ok] D02 statusLine wired — command resolves to /usr/local/bin/agentline
[--] D05 git widget not in use — skipped

summary: 7 ok, 1 skip
```

Glyphs:

| Glyph  | Meaning                              |
| ------ | ------------------------------------ |
| `[ok]` | check passed                         |
| `[!!]` | warning; not a hard failure          |
| `[XX]` | failure                              |
| `[fx]` | fix applied (only with `--fix`)      |
| `[--]` | check skipped (precondition not met) |

### JSON

```bash
agentline doctor --json | jq '.results[] | select(.status != "pass")'
```

Each result is `{ id, title, status, message, hint? }` plus a
top-level `worst` field summarising the worst status seen.

## Exit codes

| Code | Meaning                                                                           |
| ---- | --------------------------------------------------------------------------------- |
| `0`  | every check passed (or only `warn` / `skip` and `--strict` is not set)            |
| `1`  | unrecoverable error during the doctor run itself (e.g. `~/.claude/` not readable) |
| `2`  | configuration error (schema / parse)                                              |
| `3`  | a check failed and `--strict` is set                                              |

`--strict` is the right flag for CI: it flips warnings into non-zero
so an unresolved warning surfaces in the build log instead of
silently shipping.

## When to run

- After `scripts/install.sh` — sanity check the wiring.
- After upgrading `@odere-pro/agentline` — verify migrations.
- When the statusline shows the fallback line — the failing check
  tells you which layer to look at.
- In CI, with `--strict`, against a representative config.
