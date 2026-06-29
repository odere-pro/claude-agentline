# CLI reference

Complete flag-by-flag reference for every `agentline` subcommand. Intended as the developer source of truth for reviewing and revalidating the CLI surface.

Every subcommand accepts `-h` / `--help`. The default invocation (no subcommand, no flags) runs the render path.

The top-level surface is intentionally small: **`reset` · `uninstall` · `doctor` · `edit`**. `install` is still dispatched (npm/postinstall flows, the `--from-source` dev path, and existing scripts call it) but is hidden from `agentline --help`; `reset` is the user/agent-facing way to apply or re-apply defaults.

---

## Command overview

| Command                   | Purpose                                             | Writes to disk |
| ------------------------- | --------------------------------------------------- | -------------- |
| _(default)_               | Read stdin JSON, render statusline, write to stdout | no             |
| [`start`](#start)         | Wire the installed version to your config + preview | **yes**        |
| [`reset`](#reset)         | Restore defaults: reseed config + rewire statusLine | **yes**        |
| [`uninstall`](#uninstall) | Undo install; restore pre-install state             | **yes**        |
| [`config`](#config)       | Inspect/set config (`refresh`); `undo` / `redo`     | with `<value>` |
| [`doctor`](#doctor)       | Diagnose host wiring; `--fix` repairs D01–D04, D09  | with `--fix`   |
| [`edit`](#edit)           | Open the interactive TUI editor                     | with save      |
| [`version`](#version)     | Print binary version                                | no             |
| [`help`](#help)           | Print the top-level command list                    | no             |

The `render` subcommand is retained for the golden-snapshot harness and doctor's D08 check but is not listed in `agentline --help`; see [`render` (hidden)](#render-hidden) below. [`install`](#install-hidden) is similarly dispatched-but-hidden — kept for npm/postinstall and the `--from-source` dev flow; end users and agents should use [`reset`](#reset) instead.

---

## Default invocation (render path)

```bash
agentline                        # read stdin, render, write to stdout
agentline [accessibility-flags]  # same, with colour/unicode overrides
```

Called by Claude Code on every prompt render. Claude Code pipes a JSON payload to stdin; agentline writes one ANSI-styled line (or multiple if `lines` has more than one entry) to stdout and exits.

**Stdin contract:** a single JSON object matching the Claude Code statusline contract. An empty payload (no bytes or whitespace-only) emits a one-line fallback and exits 1.

**First-run hint:** when stderr is a TTY and no user config exists, agentline prints a one-time hint recommending `agentline reset` to seed the default config. Suppress with `AGENTLINE_QUIET=1`.

**Exit codes:** `0` success · `1` stdin parse error or empty stdin

---

## start

```bash
agentline start [options]
```

Use the installed agentline binary with the config you already have. Run it after upgrading the package (`npm i -g @odere-pro/agentline`) to start using the new version: it re-wires the Claude Code `statusLine` to the installed binary and then prints a one-shot preview rendered through your existing config so you can confirm it works. On a host that was never set up, `start` performs the first-time wiring too.

`start` is the visible, **config-preserving** counterpart to the hidden [`install`](#install-hidden) and the config-overwriting [`reset`](#reset). It delegates to `scripts/install.sh` **without** `--reset`, so your `config.json` is never touched.

| Flag            | Type | Default | Description                                                                |
| --------------- | ---- | ------- | -------------------------------------------------------------------------- |
| `--from-source` | flag | off     | `npm link` from the local checkout instead of installing from the registry |
| `--force`       | flag | off     | Overwrite a `statusLine` value even when it does not point at agentline    |
| `--dry-run`     | flag | off     | Print every action that would be taken; touch nothing (no preview)         |
| `--no-preview`  | flag | off     | Wire the statusLine but skip the preview                                   |
| `-h` / `--help` | flag | —       | Show command help                                                          |

**Preview scope:** the preview is rendered against a synthetic payload (there is no live Claude Code payload at `start` time), so it confirms your layout and colours. Widgets that need a live transcript (tokens, session) are hidden; git widgets reflect the directory you ran `start` from.

**Examples:**

```bash
agentline start                            # rewire + show a preview
agentline start --no-preview               # rewire only
agentline start --dry-run                  # preview the wiring actions; touch nothing
```

---

## reset

```bash
agentline reset [options]
```

Restores agentline to its shipped default state. This is the user/agent-facing entry point. It delegates to `scripts/install.sh --reset`: it **overwrites** the user config with `templates/default.config.json` (the bare installer preserves an existing config — that preservation is exactly the confusion `reset` removes), re-seeds themes and skills, and ensures `statusLine` is wired. On a host that was never set up, `reset` also performs the first-time wiring.

| Flag            | Type | Default | Description                                                                |
| --------------- | ---- | ------- | -------------------------------------------------------------------------- |
| `--from-source` | flag | off     | `npm link` from the local checkout instead of installing from the registry |
| `--force`       | flag | off     | Overwrite a `statusLine` value even when it does not point at agentline    |
| `--dry-run`     | flag | off     | Print every action that would be taken; touch nothing                      |
| `-h` / `--help` | flag | —       | Show command help                                                          |

**Destructive scope:** only `config.json` is overwritten. Themes/skills you edited and any pre-install `statusLine` backup are preserved (the backup is first-writer-wins, so re-running `reset` never clobbers the genuine pre-install snapshot).

**Next steps on success:** `reset` prints a short nudge — restart Claude Code to see the statusline, then `agentline edit` to customize or `agentline uninstall` to remove it. It is suppressed on `--dry-run` and on a failed wire. The hidden [`install`](#install-hidden) verb prints the same nudge; [`start`](#start) shows a live preview instead.

**Examples:**

```bash
agentline reset                            # reseed config + rewire statusLine
agentline reset --from-source              # dev checkout (npm link first)
agentline reset --dry-run                  # preview without touching files
```

---

## install (hidden)

```bash
agentline install [options]
```

> **Hidden from `agentline --help`.** Kept for npm/postinstall flows, the `--from-source` dev path, and existing scripts/docs. End users and agents should use [`reset`](#reset). The only behavioural difference: `install` **preserves** an existing user config, whereas `reset` overwrites it from the default template.

Wires agentline into Claude Code. Delegates to `scripts/install.sh`; flags are forwarded 1-to-1. Idempotent — re-running on an already-installed host is a no-op.

| Flag            | Type | Default | Description                                                                       |
| --------------- | ---- | ------- | --------------------------------------------------------------------------------- |
| `--from-source` | flag | off     | `npm link` from the local checkout instead of installing from the registry        |
| `--force`       | flag | off     | Overwrite an existing `statusLine` value even when it does not point at agentline |
| `--dry-run`     | flag | off     | Print every action that would be taken; touch nothing                             |
| `-h` / `--help` | flag | —       | Show command help                                                                 |

**Scope:** install always wires the global `~/.claude/settings.json` (honours `$CLAUDE_CONFIG_DIR`). Per-project local wiring is not exposed by the v0.1.0 CLI.

**Steps performed (in order):**

1. Install `@odere-pro/agentline` globally (or `npm link` with `--from-source`).
2. Seed user config from the default template (preserves existing).
3. Seed shipped themes into the user themes directory (preserves existing).
4. Copy agentline skill files (`agentline*.md`) into `$HOME/.claude/agents/` (skips existing; skipped entirely when Claude Code is not installed, i.e. `$HOME/.claude/` does not exist).
5. Wire `statusLine` into `~/.claude/settings.json`, backing up any foreign prior value.

**Existing `statusLine` preservation:** if `statusLine` already contains a foreign value, it is backed up to `${CLAUDE_CONFIG_DIR:-~/.config/agentline}/state/settings-backup.json` before being overwritten. `agentline uninstall` reads this backup to restore the original value.

**Exit codes:** passes through the exit code from `scripts/install.sh` · `0` success

**Next steps on success:** prints the same nudge as [`reset`](#reset) (restart Claude Code, then `agentline edit` / `agentline uninstall`); suppressed on `--dry-run` and on a failed wire.

**Examples:**

```bash
agentline install                          # wire ~/.claude/settings.json
agentline install --from-source            # dev checkout (npm link first)
agentline install --force                  # overwrite a foreign statusLine
agentline install --dry-run                # preview without touching files
```

---

## uninstall

```bash
agentline uninstall [options]
```

Removes agentline from the host. Idempotent — safe to re-run. Delegates to `scripts/uninstall.sh`.

| Flag            | Type | Default | Description                                                   |
| --------------- | ---- | ------- | ------------------------------------------------------------- |
| `--purge`       | flag | off     | Also remove user-edited config files, themes, and skill files |
| `--dry-run`     | flag | off     | Print every action that would be taken; touch nothing         |
| `-h` / `--help` | flag | —       | Show command help                                             |

**Steps performed (in order):**

1. Run `npm uninstall -g @odere-pro/agentline` (skipped if not installed globally).
2. Remove shipped themes that are byte-identical to the bundled originals (user-edited themes are preserved, unless `--purge`).
3. Remove the seeded user config if its bytes still match the original template (preserved unless `--purge`).
4. Remove agentline skill files from `$HOME/.claude/agents/` if their bytes still match the source (preserved unless `--purge`).
5. Restore `statusLine` in Claude Code settings from the backup, or remove the key if no prior value existed.

**Install/uninstall round-trip:** running `install` followed by `uninstall` on the same host leaves no diff against the pre-install state.

**Exit codes:** passes through the exit code from `scripts/uninstall.sh` · `0` success

**Examples:**

```bash
agentline uninstall              # clean uninstall; preserve user-edited files
agentline uninstall --purge      # full wipe including user config and edits
agentline uninstall --dry-run    # preview actions
```

---

## config

```bash
agentline config refresh [<seconds>]
```

Inspects or sets scalar top-level config keys. Today the only subject is
the statusline refresh interval.

**`agentline config refresh`** (no argument) prints the current effective
`refreshInterval` — just the integer, followed by a newline.

**`agentline config refresh <seconds>`** validates `<seconds>` as an
integer `>= 0`, persists it to agentline's own config at
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`, and re-syncs
`~/.claude/settings.json`. `0` disables the timer: agentline omits
`statusLine.refreshInterval` from `settings.json` so Claude Code reverts
to event-driven updates only. `1`+ is written through to
`statusLine.refreshInterval`, which re-runs the statusline command every
N seconds in addition to event-driven updates. Default is `5`.

If agentline's `statusLine` is not currently wired, the config value is
still updated but no partial `statusLine` is created — the command prints
a hint to run `agentline install`.

| Argument    | Type | Default | Description                                                         |
| ----------- | ---- | ------- | ------------------------------------------------------------------- |
| `<seconds>` | int  | —       | Refresh interval in seconds; `>= 0`. `0` disables. Omit to read it. |

**Exit codes:** `0` success · non-zero on an argument or validation
error, with an `agentline config refresh: …` message.

**Examples:**

```bash
agentline config refresh           # print the current value (e.g. 5)
agentline config refresh 10        # refresh every 10 seconds
agentline config refresh 0         # disable; event-driven updates only
```

### config undo / config redo

```bash
agentline config undo
agentline config redo
```

Rolls a config change back (`undo`) or forward again (`redo`). Every
config-writing path — a `config widget` mutation (`add` / `remove` /
`move` / `replace` / `set-option`) and a TUI editor save — backs up the
prior config to the back slot (`config.json.bak`) before the new config
lands. `config undo` restores that backup atomically, capturing the
pre-undo config into a forward slot (`config.json.redo`) so `config redo`
can roll it forward again.

It is a **one-step** reversible stack (one back, one forward), not a
multi-level history. A **new edit after an undo** — any `config widget`
mutation or TUI save — invalidates the forward slot: you cannot redo into
a branch you have diverged from. When there is nothing to undo (or redo),
the command prints `nothing to undo` (`nothing to redo`) and exits
non-zero — it never crashes.

**Exit codes:** `0` success · non-zero when there is nothing to undo/redo
or the backup is unreadable, with an `agentline config undo: …`
(`agentline config redo: …`) message.

```bash
agentline config widget add clock   # mutate (backs up the prior config)
agentline config undo               # restore the prior config
agentline config redo               # re-apply the widget add
```

---

## doctor

```bash
agentline doctor [options]
```

Runs eleven health checks (D01–D11) against the host configuration. With `--fix`, auto-repairs D01–D04 and D09.

| Flag            | Type | Default | Description                                                                                           |
| --------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------- |
| `--fix`         | flag | off     | Attempt to repair D01–D04 (settings file, statusLine, user config, themes) and D09 (refresh interval) |
| `--json`        | flag | off     | Machine-readable JSON output; suppresses the human formatter                                          |
| `--strict`      | flag | off     | Promote unresolved warnings/failures to non-zero exit (for CI gates)                                  |
| `-h` / `--help` | flag | —       | Show command help                                                                                     |

**Checks:**

| ID  | What it checks                                      | Auto-fixable |
| --- | --------------------------------------------------- | ------------ |
| D01 | `~/.claude/settings.json` exists                    | yes          |
| D02 | `statusLine` wired to agentline                     | yes          |
| D03 | User/project config valid schema                    | yes (seed)   |
| D04 | Theme files present                                 | yes (copy)   |
| D05 | `git` on PATH                                       | no           |
| D06 | Config directory writable                           | no           |
| D07 | Update-check cache (read-only)                      | no           |
| D08 | Render snapshot matches golden                      | no           |
| D09 | `statusLine.refreshInterval` matches config         | yes          |
| D10 | Claude CLI health (read-only)                       | no           |
| D11 | Widget config sanity (unknown/removed widget types) | no           |

**Glyphs in output:** `[ok]` passed · `[!!]` warning · `[XX]` failed · `[fx]` fixed · `[--]` skipped

**Exit codes:**

- Default mode: `0` always (warnings do not fail)
- `--strict` mode: `0` all ok · `1` at least one warning or failure unresolved

**Examples:**

```bash
agentline doctor                  # full health report
agentline doctor --fix            # repair D01–D04 and D09
agentline doctor --strict         # non-zero on any issue (CI)
agentline doctor --json | jq .    # machine-readable
```

---

## edit

```bash
agentline edit
```

Opens the interactive TUI editor (Ink-based) — the primary surface for adding, reordering, recolouring, and toggling widgets with a live preview.

The TUI editor is lazy-loaded (`dist/tui.mjs` is a separate bundle) so the render path stays light. Reads the active config on entry, writes atomically on save. Requires a TTY; non-interactive contexts produce no output.

**Reset:** [`agentline reset`](#reset) discards your edits and reseeds `templates/default.config.json`:

```bash
agentline reset
```

---

## render (hidden)

```bash
agentline render [options]
```

Re-renders a recorded stdin payload from a file (instead of live stdin). Used by the golden-snapshot harness, doctor's D08 check, and CI pipelines. Produces byte-identical output to the default invocation given the same payload.

Not listed in `agentline --help` — call it directly when you need fixture replay.

| Flag                   | Type   | Default | Description                                                                  |
| ---------------------- | ------ | ------- | ---------------------------------------------------------------------------- |
| `--fixture <path>`     | string | —       | Read JSON payload from this file instead of stdin                            |
| `--config <path>`      | string | —       | Pin a specific config file (bypass the default config resolution)            |
| `--frozen-clock <iso>` | string | —       | Inject a fixed ISO 8601 timestamp so clock-dependent output is deterministic |
| `--width <n>`          | int    | —       | Force terminal width to `n` columns                                          |
| `--no-color`           | flag   | off     | Disable colour output                                                        |
| `--no-colour`          | flag   | off     | Alias for `--no-color`                                                       |
| `--no-unicode`         | flag   | off     | Disable unicode glyphs; fall back to ASCII                                   |
| `--ascii`              | flag   | off     | Alias for `--no-unicode`                                                     |
| `-h` / `--help`        | flag   | —       | Show command help                                                            |

**Without `--fixture`:** reads from stdin (same as the default invocation). The subcommand exists mainly to add `--frozen-clock` and `--config` overrides.

**`--frozen-clock`:** ISO 8601 string (e.g. `2025-01-15T12:00:00.000Z`). Injected into the render clock so any widget that depends on the current time is deterministic. Required for golden-snapshot reproducibility across timezones and CI runners.

**Exit codes:** `0` success · `1` fixture file not found or empty payload

**Examples:**

```bash
agentline render --fixture tests/fixtures/payload.json
agentline render --fixture payload.json \
  --config tests/configs/minimal.json \
  --frozen-clock 2025-01-15T12:00:00.000Z
NO_COLOR=1 agentline render --fixture payload.json  # test no-colour output
```

---

## version

```bash
agentline version
agentline --version
agentline -v
```

Prints the installed binary version and exits.

**Output:** `agentline <version>` followed by a newline.

**Exit codes:** `0` always

---

## help

```bash
agentline help
agentline --help
agentline -h
```

Prints the top-level subcommand list and exits.

**Exit codes:** `0` always

---

## Shared accessibility flags

The following flags are accepted by `render` and forwarded to the ANSI encoder:

| Flag           | Alias         | Effect                                           |
| -------------- | ------------- | ------------------------------------------------ |
| `--no-color`   | `--no-colour` | Disable all ANSI colour codes; plain text output |
| `--no-unicode` | `--ascii`     | Replace unicode separators and glyphs with ASCII |

`NO_COLOR=1` in the environment has the same effect as `--no-color` and takes precedence over any theme or config setting.

Colour-depth auto-detection reads `COLORTERM`, `TERM`, and `TERM_PROGRAM`. Detected levels: `truecolor` → `256` → `16` → `none`.

---

## Environment variables

| Variable                    | Scope       | Effect                                                                                                                                                           |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NO_COLOR`                  | global      | Disable colour output (equivalent to `--no-color`; takes precedence)                                                                                             |
| `AGENTLINE_QUIET`           | render path | Set to `1` to suppress the first-run "using built-in defaults" hint on stderr                                                                                    |
| `CLAUDE_CONFIG_DIR`         | global      | Override the parent of the agentline config dir. Default: `~/.config`                                                                                            |
| `AGENTLINE_BIN`             | scripts     | Force a specific binary path in shell scripts and CI; useful for testing                                                                                         |
| `AGENTLINE_TRANSCRIPT_ROOT` | render path | Override the directory tree that `transcriptPath` is allowed to resolve under. Default is the user's `~/.claude` tree. Test-only; production should leave unset. |
| `AGENTLINE_*`               | render path | Override any config leaf: dot-path in `UPPER_SNAKE_CASE`, prefixed `AGENTLINE_`                                                                                  |

**`AGENTLINE_*` override examples:**

```bash
AGENTLINE_THEME=vscode-dark           # change theme without editing config
AGENTLINE_GLOBAL_PADDING=0            # tighter spacing
AGENTLINE_POWERLINE_ENABLED=true      # force-enable powerline glyphs
```

Values are parsed as JSON when they look like JSON literals (`true`, `false`, numbers, quoted strings), otherwise treated as plain strings. Setting a variable to the empty string clears the override.

---

## Exit code summary

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | Success                                                         |
| `1`  | Runtime error: empty stdin, missing file, no themes found, etc. |
| `2`  | Bad arguments or schema / config validation failure             |

`doctor` without `--strict` always exits `0` (warnings are informational). `doctor --strict` exits `1` when any check is warn or fail.
