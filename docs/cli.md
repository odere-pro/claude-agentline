# CLI reference

Complete flag-by-flag reference for every `agentline` subcommand. Intended as the developer source of truth for reviewing and revalidating the CLI surface.

Every subcommand accepts `-h` / `--help`. The default invocation (no subcommand, no flags) runs the render path.

---

## Command overview

| Command                        | Purpose                                                  | Writes to disk |
| ------------------------------ | -------------------------------------------------------- | -------------- |
| _(default)_                    | Read stdin JSON, render statusline, write to stdout      | no             |
| [`preview`](#preview)          | Render a sample bar without a live Claude Code session   | no             |
| [`init`](#init)                | Scaffold a config file from a shipped preset             | **yes**        |
| [`config`](#config)            | Edit configuration in the interactive TUI (Ink)          | **yes**        |
| [`doctor`](#doctor)            | Diagnose host wiring; `--fix` repairs D01–D04            | with `--fix`   |
| [`install`](#install)          | Wire `statusLine` and install skill files                | **yes**        |
| [`uninstall`](#uninstall)      | Undo install; restore pre-install state                  | **yes**        |
| [`themes`](#themes)            | Browse and inspect theme presets                         | no             |
| [`keys`](#keys)                | List active keymap bindings                              | no             |
| [`schema`](#schema)            | Print or write the config JSON Schema                    | with `--write` |
| [`render`](#render)            | Replay a recorded stdin payload (fixtures/goldens)       | no             |
| [`version`](#version)          | Print binary version                                     | no             |
| [`help`](#help)                | Print the top-level command list                         | no             |

---

## Default invocation (render path)

```bash
agentline                        # read stdin, render, write to stdout
agentline [accessibility-flags]  # same, with colour/unicode overrides
```

Called by Claude Code on every prompt render. Claude Code pipes a JSON payload to stdin; agentline writes one ANSI-styled line (or multiple if `lines` has more than one entry) to stdout and exits.

**Stdin contract:** a single JSON object matching the Claude Code statusline contract. An empty payload (no bytes or whitespace-only) emits a one-line fallback and exits 1.

**First-run hint:** when stderr is a TTY and no user/project config exists, agentline prints a one-time hint recommending `agentline init`. Suppress with `AGENTLINE_QUIET=1`.

**Exit codes:** `0` success · `1` stdin parse error or empty stdin

---

## preview

```bash
agentline preview [options]
```

Renders a representative statusline bar using a built-in sample payload. Produces byte-identical output to the live render path (same pipeline, different stdin source).

| Flag                   | Type     | Default              | Description                                                       |
| ---------------------- | -------- | -------------------- | ----------------------------------------------------------------- |
| `--theme <name>`       | string   | —                    | Render with the named theme from the user dir or builtin set      |
| `--all-themes`         | flag     | off                  | Stack one render per shipped theme                                |
| `--config <path>`      | string   | user config or template | Render against a specific config file                          |
| `--minimal`            | flag     | off                  | Preview the shipped `minimal` template without writing it         |
| `--default`            | flag     | off                  | Preview the shipped `default` template without writing it         |
| `--watch` / `-w`       | flag     | off                  | Re-render when the config file changes (TTY only)                 |
| `--no-color`           | flag     | off                  | Disable colour output (also honoured via `NO_COLOR` env)          |
| `--no-colour`          | flag     | off                  | Alias for `--no-color`                                            |
| `--no-unicode`         | flag     | off                  | Disable unicode glyphs; fall back to ASCII                        |
| `--ascii`              | flag     | off                  | Alias for `--no-unicode`                                          |
| `-h` / `--help`        | flag     | —                    | Show command help                                                 |

**Config resolution order (when `--config` is absent):** user config (`~/.config/agentline/config.json`) if it exists, else the shipped `default` template.

**`--watch` behaviour:**
- Requires an interactive TTY on stdout; exits 1 otherwise.
- Enters the terminal's alternate screen buffer on start; restores it on Ctrl+C.
- Watches the resolved config file path using `fs.watch`. Re-attaches the watcher after atomic-write renames (write-tmp + rename pattern).
- 80 ms debounce coalesces rapid editor saves into one render.

**Mutual exclusions:** `--config` and `--minimal`/`--default` are mutually exclusive.

**Exit codes:** `0` success · `1` no themes found (with `--all-themes`) or no TTY (with `--watch`)

**Examples:**

```bash
agentline preview                            # uses saved config or default template
agentline preview --all-themes               # compare all four shipped themes
agentline preview --theme vscode-dark        # pin one theme
agentline preview --config .claude/agentline.json --watch  # live dev loop
agentline preview --minimal                  # snapshot the minimal preset
NO_COLOR=1 agentline preview                 # test no-colour degradation
COLORTERM= TERM=xterm-256color agentline preview  # simulate 256-colour
```

---

## init

```bash
agentline init [options]
```

Scaffolds a config file from a shipped preset. Writes atomically (write-temp + fsync + rename). Refuses to overwrite an existing target unless `--force` is passed.

After a successful write, prints two next-step hints: `agentline preview` and `agentline doctor --fix`.

| Flag                | Type     | Default     | Description                                                                                |
| ------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------ |
| `--preset <name>`   | enum     | `default`   | One of `minimal` · `default` · `focus` · `power`                                          |
| `--scope <where>`   | enum     | `project`   | `project` → `.claude/agentline.json` in CWD; `user` → `~/.config/agentline/config.json`   |
| `--target <path>`   | string   | —           | Explicit output path; takes precedence over `--scope`                                      |
| `--force`           | flag     | off         | Overwrite an existing target                                                               |
| `--minimal`         | flag     | off         | Deprecated alias for `--preset minimal`; mutually exclusive with `--preset`                |
| `-h` / `--help`     | flag     | —           | Show command help                                                                          |

**Presets:**

| Name      | Contents                                                           |
| --------- | ------------------------------------------------------------------ |
| `minimal` | model, git-branch, clock                                           |
| `default` | model, git-branch, git-status, context, tokens, cost, clock        |
| `focus`   | model, git-branch, context-percentage, clock                       |
| `power`   | default + thinking-effort, weekly-usage, block-timer               |

**Exit codes:** `0` success · `1` target already exists (without `--force`) or template file missing

**Examples:**

```bash
agentline init                                        # default preset, project scope
agentline init --preset minimal --scope user          # seed the user config
agentline init --preset power --target ~/my.json      # explicit path
agentline init --force --preset default               # reset project config to defaults
```

---

## config

```bash
agentline config
```

Opens the interactive TUI configuration editor (powered by Ink, lazy-loaded so the render path stays light). Reads the active layered config on entry, writes atomically on save.

No command-line flags beyond `-h` / `--help`.

**Side effects:** writes the user config (`~/.config/agentline/config.json`) atomically if the user saves.

**Requires a TTY.** Running in a non-interactive context produces no output.

---

## doctor

```bash
agentline doctor [options]
```

Runs ten health checks (D01–D10) against the host configuration. With `--fix`, auto-repairs D01–D04.

| Flag            | Type   | Default | Description                                                              |
| --------------- | ------ | ------- | ------------------------------------------------------------------------ |
| `--fix`         | flag   | off     | Attempt to repair D01–D04 (settings file, statusLine, user config, themes)|
| `--json`        | flag   | off     | Machine-readable JSON output; suppresses the human formatter             |
| `--strict`      | flag   | off     | Promote unresolved warnings/failures to non-zero exit (for CI gates)     |
| `-h` / `--help` | flag   | —       | Show command help                                                        |

**Checks:**

| ID  | What it checks                    | Auto-fixable |
| --- | --------------------------------- | ------------ |
| D01 | `~/.claude/settings.json` exists  | yes          |
| D02 | `statusLine` wired to agentline   | yes          |
| D03 | User/project config valid schema  | yes (seed)   |
| D04 | Theme files present               | yes (copy)   |
| D05 | Nerd Font available (Powerline)   | no           |
| D06 | `git` on PATH                     | no           |
| D07 | Pricing table age ≤ 90 days       | no           |
| D08 | `CLAUDE_CONFIG_DIR` writable      | no           |
| D09 | `command` widget binary on PATH   | no           |
| D10 | Render snapshot matches golden    | no           |

**Glyphs in output:** `[ok]` passed · `[!!]` warning · `[XX]` failed · `[fx]` fixed · `[--]` skipped

**Exit codes:**
- Default mode: `0` always (warnings do not fail)
- `--strict` mode: `0` all ok · `1` at least one warning or failure unresolved

**`--json` output shape:**

```json
{
  "checks": [
    { "id": "D01", "status": "ok", "message": "settings file present" },
    ...
  ],
  "fixed": ["D01", "D02"],
  "exitCode": 0
}
```

**Examples:**

```bash
agentline doctor                  # full health report
agentline doctor --fix            # repair D01–D04
agentline doctor --strict         # non-zero on any issue (CI)
agentline doctor --json | jq .    # machine-readable
```

---

## install

```bash
agentline install [options]
```

Wires agentline into Claude Code. Delegates to `scripts/install.sh`; flags are forwarded 1-to-1. Idempotent — re-running on an already-installed host is a no-op.

| Flag              | Type              | Default   | Description                                                                           |
| ----------------- | ----------------- | --------- | ------------------------------------------------------------------------------------- |
| `--from-source`   | flag              | off       | `npm link` from the local checkout instead of installing from the registry            |
| `--force`         | flag              | off       | Overwrite an existing `statusLine` value even when it does not point at agentline     |
| `--dry-run`       | flag              | off       | Print every action that would be taken; touch nothing                                 |
| `-h` / `--help`   | flag              | —         | Show command help                                                                     |

**Scope:** install always wires the global `~/.claude/settings.json` (honours `$CLAUDE_CONFIG_DIR`). Per-project local wiring is not exposed by the v0.1.0 CLI.

**Steps performed (in order):**
1. Install `@agentline/cli` globally (or `npm link` with `--from-source`).
2. Seed user config from the default template (preserves existing).
3. Seed shipped themes into the user themes directory (preserves existing).
4. Copy agentline skill files (`agentline*.md`) into `$HOME/.claude/agents/` (skips existing).
5. Wire `statusLine` into `~/.claude/settings.json`, backing up any foreign prior value.

**Existing `statusLine` preservation:** if `statusLine` already contains a foreign value, it is backed up to `${CLAUDE_CONFIG_DIR:-~/.config/agentline}/state/settings-backup.json` before being overwritten. `agentline uninstall` reads this backup to restore the original value.

**Exit codes:** passes through the exit code from `scripts/install.sh` · `0` success

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

| Flag            | Type | Default | Description                                                                         |
| --------------- | ---- | ------- | ----------------------------------------------------------------------------------- |
| `--purge`       | flag | off     | Also remove user-edited config files, themes, and skill files                       |
| `--dry-run`     | flag | off     | Print every action that would be taken; touch nothing                               |
| `-h` / `--help` | flag | —       | Show command help                                                                   |

**Steps performed (in order):**
1. Run `npm uninstall -g @agentline/cli` (skipped if not installed globally).
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

## themes

```bash
agentline themes [options]
```

Browse and inspect the installed theme presets. With no flags, renders a swatch table: one row per theme with 13 coloured blocks showing the palette.

| Flag            | Type   | Default | Description                                                               |
| --------------- | ------ | ------- | ------------------------------------------------------------------------- |
| `--list`        | flag   | off     | Machine-readable output: `name<TAB>path` rows, one per line               |
| `--show <name>` | string | —       | Pretty-print the resolved palette for one theme                           |
| `-h` / `--help` | flag   | —       | Show command help                                                         |

**Theme search path:** user themes dir (`~/.config/agentline/themes/`) then builtin (`themes/` at the package root). User themes take precedence; names are deduplicated.

**`--show` output:** theme name, file path, and one palette role per row with an inline colour swatch (when colour is available).

**`--show` name validation:** `<name>` must match `^[a-zA-Z0-9._-]+$` and must not start with a dot. Names containing `/`, `..`, or other path-shaped characters are rejected with exit code `2`, so `agentline themes --show ../../etc/passwd` cannot escape the themes search path.

**Swatch table (no flags):** in `none`-depth terminals (e.g. `NO_COLOR=1`), the swatch column falls back to two-character role abbreviations.

**Exit codes:** `0` success · `1` no themes found or theme name not found (with `--show`) · `2` invalid `--show` name

**Examples:**

```bash
agentline themes                          # swatch table
agentline themes --show claude-code-dark  # inspect one palette
agentline themes --list                   # machine-readable name+path list
agentline themes --list | grep vscode     # filter
agentline preview --all-themes            # full live render per theme
```

---

## keys

```bash
agentline keys [options]
```

Lists active keymap bindings for the `agentline config` TUI editor. Reads the active config's `keymap` overrides if a config is present; falls back to defaults if loading fails.

| Flag            | Type | Default | Description                                                 |
| --------------- | ---- | ------- | ----------------------------------------------------------- |
| `--json`        | flag | off     | Emit machine-readable JSON (`{ "bindings": [...] }`)        |
| `-h` / `--help` | flag | —       | Show command help                                           |

**JSON binding shape:**
```json
{ "key": "ctrl+s", "action": "save", "scope": "editor", "description": "Save and exit" }
```

**Exit codes:** `0` always

**Examples:**

```bash
agentline keys                   # human-readable table
agentline keys --json            # JSON for scripting or gate coverage
agentline keys --json | jq '.bindings[].action'
```

---

## schema

```bash
agentline schema [options]
```

Prints the embedded JSON Schema for `agentline.json` config files, or writes it to a directory so editors can pick it up.

| Flag              | Type   | Default | Description                                                             |
| ----------------- | ------ | ------- | ----------------------------------------------------------------------- |
| `--write <dir>`   | string | —       | Write `<dir>/agentline.config.schema.json` atomically                   |
| `-h` / `--help`   | flag   | —       | Show command help                                                       |

**Without `--write`:** schema JSON is written to stdout. Useful for inspection or piping to `jq`.

**With `--write`:** writes `<dir>/agentline.config.schema.json` atomically. The path is printed to stdout on success. Useful for wiring up VS Code or another JSON-schema-aware editor.

**Exit codes:** `0` success · `2` bad argument

**Examples:**

```bash
agentline schema                       # print schema to stdout
agentline schema | jq .definitions     # inspect definitions
agentline schema --write .vscode/      # drop schema for VS Code
agentline schema --write /tmp/         # ad-hoc inspection
```

---

## render

```bash
agentline render [options]
```

Re-renders a recorded stdin payload from a file (instead of live stdin). Used by the golden-snapshot harness, doctor's D10 check, and CI pipelines. Produces byte-identical output to the default invocation given the same payload.

| Flag                    | Type   | Default | Description                                                                        |
| ----------------------- | ------ | ------- | ---------------------------------------------------------------------------------- |
| `--fixture <path>`      | string | —       | Read JSON payload from this file instead of stdin                                  |
| `--config <path>`       | string | —       | Pin a specific config file (bypass the default config resolution)                  |
| `--frozen-clock <iso>`  | string | —       | Inject a fixed ISO 8601 timestamp so clock-dependent output is deterministic       |
| `--width <n>`           | int    | —       | Force terminal width to `n` columns                                                |
| `--no-color`            | flag   | off     | Disable colour output                                                              |
| `--no-colour`           | flag   | off     | Alias for `--no-color`                                                             |
| `--no-unicode`          | flag   | off     | Disable unicode glyphs; fall back to ASCII                                         |
| `--ascii`               | flag   | off     | Alias for `--no-unicode`                                                           |
| `-h` / `--help`         | flag   | —       | Show command help                                                                  |

**Without `--fixture`:** reads from stdin (same as the default invocation). The subcommand exists mainly to add `--frozen-clock` and `--config` overrides.

**`--frozen-clock`:** ISO 8601 string (e.g. `2025-01-15T12:00:00.000Z`). Injected into the clock widget and any widget that depends on `Date.now()`. Required for golden-snapshot reproducibility across timezones and CI runners.

**Exit codes:** `0` success · `1` fixture file not found or empty payload

**Examples:**

```bash
agentline render                                    # same as default invocation
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

The following flags are accepted by `preview` and `render` and forwarded to the ANSI encoder:

| Flag           | Alias          | Effect                                                 |
| -------------- | -------------- | ------------------------------------------------------ |
| `--no-color`   | `--no-colour`  | Disable all ANSI colour codes; plain text output       |
| `--no-unicode` | `--ascii`      | Replace unicode separators and glyphs with ASCII       |

`NO_COLOR=1` in the environment has the same effect as `--no-color` and takes precedence over any theme or config setting.

Colour-depth auto-detection reads `COLORTERM`, `TERM`, and `TERM_PROGRAM`. Detected levels: `truecolor` → `256` → `16` → `none`.

---

## Environment variables

| Variable                                  | Scope         | Effect                                                                                                                                                          |
| ----------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NO_COLOR`                                | global        | Disable colour output (equivalent to `--no-color`; takes precedence)                                                                                            |
| `AGENTLINE_QUIET`                         | render path   | Set to `1` to suppress the first-run "using built-in defaults" hint on stderr                                                                                   |
| `CLAUDE_CONFIG_DIR`                       | global        | Override the parent of the agentline config dir. Default: `~/.config`                                                                                           |
| `CLAUDE_PROJECT_DIR`                      | init, install | Override the project root for project-scoped config path. Default: `$PWD`                                                                                       |
| `AGENTLINE_BIN`                           | scripts       | Force a specific binary path in shell scripts and CI; useful for testing                                                                                        |
| `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS` | config load   | Set to `1` to opt in to `command` widgets sourced from `.agentline.json` (the project layer). Without this, project-layer `command` widgets are silently dropped and a one-line warning is written to stderr. See `widgets.md`. |
| `AGENTLINE_TRANSCRIPT_ROOT`               | render path   | Override the directory tree that `transcriptPath` is allowed to resolve under. Default is the user's `~/.claude` tree. Test-only; production should leave unset. |
| `AGENTLINE_*`                             | render path   | Override any config leaf: dot-path in `UPPER_SNAKE_CASE`, prefixed `AGENTLINE_`                                                                                 |

**`AGENTLINE_*` override examples:**

```bash
AGENTLINE_THEME=vscode-dark agentline preview
AGENTLINE_GLOBAL_PADDING=0 agentline preview
AGENTLINE_POWERLINE_ENABLED=true agentline preview
```

Values are parsed as JSON when they look like JSON literals (`true`, `false`, numbers, quoted strings), otherwise treated as plain strings. Setting a variable to the empty string clears the override.

---

## Exit code summary

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | Success                                                              |
| `1`  | Runtime error: empty stdin, missing file, no themes found, etc.      |
| `2`  | Bad arguments or schema / config validation failure                  |

`doctor` without `--strict` always exits `0` (warnings are informational). `doctor --strict` exits `1` when any check is warn or fail.
