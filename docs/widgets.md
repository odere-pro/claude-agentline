# Widgets

A widget is the unit of content on a statusline. Each widget is a small
function: stdin payload + merged config + theme go in, a coloured cell
(or `HIDDEN`) comes out. The renderer composes those cells into a line.

This page is the user-facing widget catalogue. The internal contract
(`WidgetDef`, `WidgetContext`, the registry) is documented in the
source under `src/widgets/`.

## Widget definition shape

The on-disk shape is documented in [config.md](./config.md#widget-shape).
For reference:

```json
{
  "type": "tokens-total",
  "options": { "reset": "block", "format": "human" },
  "fg": "yellow",
  "merged": "merge"
}
```

Only `type` is required. Everything else falls back to the role
defaults from the active theme (see [themes.md](./themes.md)) or to the
widget's own defaults.

## Reset axes

Token, cost, speed, and rate-limit widgets always declare a `reset`
axis on their `options`. Mixed-axis aggregation is forbidden — the
renderer rejects it with a schema error. Allowed values:

| Axis      | Resets when                            |
| --------- | -------------------------------------- |
| `session` | the Claude Code session id changes     |
| `block`   | a new conversation block starts        |
| `day`     | local-clock midnight (per the host TZ) |
| `week`    | local-clock Monday 00:00               |
| `model`   | the active model id changes            |
| `effort`  | the thinking-effort tier changes       |

If you want both per-block and per-day totals visible, declare two
widget instances with different `reset` axes.

## Built-in widgets

53 widgets ship with v0.1.0, organised into seven families. The
authoritative registry is `src/widgets/registry.ts`; this page tracks
it.

### Session (11)

Surface state from the stdin payload that Claude Code emits.

| Type              | Renders                                          |
| ----------------- | ------------------------------------------------ |
| `model`           | the active model id (e.g. `Sonnet 4.6`)          |
| `version`         | Claude Code version                              |
| `output-style`    | active output style                              |
| `session-id`      | short session id                                 |
| `session-name`    | session name (or short id when unset)            |
| `account-email`   | logged-in account email                          |
| `login-method`    | auth method (oauth / api-key / device)           |
| `org`             | active organisation name                         |
| `thinking-effort` | thinking-effort tier (low / medium / high)       |
| `vim-mode`        | current vim mode when vim keybindings are active |
| `skills`          | skills attached to the session                   |

Auth-file fallback: when the stdin payload omits account / login fields,
session widgets transparently re-read `${CLAUDE_CONFIG_DIR}/.credentials.json`
so the line is never blank for an authenticated user.

### Tokens & cost (8)

| Type            | Renders                                                 | Required `options.reset` |
| --------------- | ------------------------------------------------------- | ------------------------ |
| `tokens-total`  | running token total                                     | yes                      |
| `tokens-input`  | input-token subtotal                                    | yes                      |
| `tokens-output` | output-token subtotal                                   | yes                      |
| `tokens-cached` | cached-token subtotal (prompt-cache hits)               | yes                      |
| `cost`          | running USD cost (per the embedded pricing table; §8.5) | yes                      |
| `input-speed`   | input tokens per second over the active window          | yes                      |
| `output-speed`  | output tokens per second                                | yes                      |
| `total-speed`   | combined throughput                                     | yes                      |

The pricing table is embedded at build time and refreshed via the
`pricing-skew.yml` workflow (see [doctor.md](./doctor.md#d07-pricing-table-fresh)).
When the table is older than 90 days, `doctor` reports D07.

### Context (4)

| Type                        | Renders                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `context-length`            | tokens currently in the context window                             |
| `context-percentage`        | percentage of the model's context window in use                    |
| `context-percentage-usable` | percentage of usable context (excludes reserved-for-output budget) |
| `context-bar`               | tiny inline bar approximating context fill                         |

### Rate limits (8)

| Type                 | Renders                                        | Required `options.reset` |
| -------------------- | ---------------------------------------------- | ------------------------ |
| `session-usage`      | percentage of the session quota consumed       | yes                      |
| `weekly-usage`       | percentage of the weekly quota consumed        | yes                      |
| `block-timer`        | time elapsed in the active conversation block  | no                       |
| `block-reset-timer`  | time remaining until the next block resets     | no                       |
| `weekly-reset-timer` | time remaining until the weekly quota resets   | no                       |
| `model-usage`        | usage broken out by model id                   | yes                      |
| `effort-usage`       | usage broken out by thinking-effort tier       | yes                      |
| `compaction-counter` | number of compactions performed in the session | no                       |

### Git (16)

Git widgets activate only when the working directory is a git checkout;
otherwise they hide themselves. They share a single per-render snapshot
so a line with sixteen git widgets only spawns `git` once.

| Type               | Renders                                         |
| ------------------ | ----------------------------------------------- |
| `git-branch`       | current branch (or short SHA when detached)     |
| `git-sha`          | short commit SHA                                |
| `git-worktree`     | basename of the current worktree                |
| `git-status`       | one-glance dirty / clean summary                |
| `git-changes`      | summary of staged / unstaged / untracked counts |
| `git-staged`       | staged-file count                               |
| `git-unstaged`     | unstaged-file count                             |
| `git-untracked`    | untracked-file count                            |
| `git-insertions`   | insertion count from `git diff --shortstat`     |
| `git-deletions`    | deletion count from `git diff --shortstat`      |
| `git-conflicts`    | merge-conflict file count                       |
| `git-ahead-behind` | commits ahead of and behind upstream            |
| `git-upstream`     | upstream branch (`origin/main`)                 |
| `git-origin-owner` | owner segment of the `origin` remote URL        |
| `git-origin-repo`  | repo segment of the `origin` remote URL         |
| `git-is-fork`      | `fork` marker if upstream owner ≠ origin owner  |

### Time (3)

| Type             | Renders                                            |
| ---------------- | -------------------------------------------------- |
| `clock`          | wall-clock time; `options.format` accepts strftime |
| `uptime-session` | session uptime (since Claude Code launch)          |
| `uptime-block`   | uptime of the active conversation block            |

### Layout / custom (3)

| Type             | Behaviour                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `separator`      | a single user-defined glyph (`options.char`); honours `merged` like any other widget                                                       |
| `flex-separator` | absorbs all remaining space on the line; in Powerline mode it is silently dropped                                                          |
| `command`        | runs `options.cmd` in a sandboxed shell (250 ms default / 2 000 ms hard timeout, 1 KiB stdout cap, no stdin, stderr discarded). See below. |

The `command` widget is the only built-in that spawns a child process.
The user owns the command string; it runs through `/bin/sh -c` (or
`cmd.exe /c` on Windows). Caching is keyed on cmd + shell + cwd with a
configurable `cacheTtlMs`.

**Sandbox bounds (spec §7.8.3):**

- `options.shell` is honoured only when it is one of `/bin/sh`,
  `/bin/bash`, `/usr/bin/sh`, `/usr/bin/bash`, `/usr/local/bin/bash`,
  `cmd.exe`, `powershell.exe`, `pwsh.exe`. Other values fall back to
  the platform default — agentline never executes an arbitrary
  user-supplied binary.
- `options.cwd` (or the stdin `cwd` fallback) is accepted only when it
  is an absolute path that exists and is a directory; otherwise the
  subprocess inherits agentline's own cwd.
- The forwarded environment is the standard PATH/HOME/LANG/TERM/etc.
  allowlist plus every `LC_*` and `CLAUDE_*` variable, _minus_ any key
  whose name ends in `_TOKEN`, `_KEY`, `_SECRET`, `_PASSWORD`, `_PASS`,
  or `_AUTH`. Credential-shaped Claude integration vars never reach
  the child.

## Choosing widgets

A useful starting point is `templates/default.config.json`:

```json
{ "type": "model" },
{ "type": "git-branch" },
{ "type": "git-changes" },
{ "type": "context-percentage" },
{ "type": "tokens-total",  "options": { "reset": "block" } },
{ "type": "cost",          "options": { "reset": "block" } },
{ "type": "session-usage", "options": { "reset": "block" } },
{ "type": "flex-separator" },
{ "type": "clock" }
```

For a leaner line — what `agentline config init --preset minimal` writes —
see `templates/minimal.config.json`. Two more presets are shipped:
`focus` (model + git + context-percentage + clock) and `power` (full
default plus thinking-effort, weekly-usage, block-timer).

## Previewing a config

Live preview is the live Claude Code session: edit `~/.config/agentline/config.json` (or the project `.claude/agentline.json`), then restart Claude Code to see the new render.

For deterministic offline replay (golden-snapshot harness, doctor's D10 check, CI), use the fixture path:

```bash
agentline render --fixture <path-to-stdin.json>            # replay a recorded payload
agentline render --fixture payload.json --config alt.json  # replay against a different config
```

`agentline render --fixture` is the goldens / replay surface.

Three reference fixtures ship under `tests/golden/`:

| Fixture                      | What it exercises                        |
| ---------------------------- | ---------------------------------------- |
| `tests/golden/minimal/`      | the `templates/minimal.config.json` line |
| `tests/golden/no-color/`     | accessibility — `--no-color` output      |
| `tests/golden/powerline-on/` | Powerline transform with chevrons        |

Each scenario has `stdin.json` (the payload), `config.json` (the active
config), `clock.txt` (frozen clock for determinism), and `expected.ansi`
(the byte-for-byte expected output).

To regenerate a golden after an intentional renderer change:

```bash
agentline render --fixture tests/golden/<name>/stdin.json \
  --config tests/golden/<name>/config.json \
  --frozen-clock "$(cat tests/golden/<name>/clock.txt)" \
  > tests/golden/<name>/expected.ansi
```
