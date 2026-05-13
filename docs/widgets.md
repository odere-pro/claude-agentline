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

39 widgets ship with v0.1.0, organised into seven families. The
authoritative registry is `src/widgets/registry.ts`; this page tracks
it.

### Session (7)

Surface state from the stdin payload that Claude Code emits.

| Type              | Renders                                    |
| ----------------- | ------------------------------------------ |
| `model`           | the active model id (e.g. `Sonnet 4.6`)    |
| `version`         | Claude Code version                        |
| `session-id`      | short session id                           |
| `session-name`    | session name (or short id when unset)      |
| `account-email`   | logged-in account email                    |
| `thinking-effort` | thinking-effort tier (low / medium / high) |
| `skills`          | skills attached to the session             |

Auth-file fallback: when the stdin payload omits the account email,
`account-email` transparently re-reads `${CLAUDE_CONFIG_DIR}/.credentials.json`
so the line is never blank for an authenticated user.

### Tokens (7)

| Type            | Renders                                        | Required `options.reset` |
| --------------- | ---------------------------------------------- | ------------------------ |
| `tokens-total`  | running token total                            | yes                      |
| `tokens-input`  | input-token subtotal                           | yes                      |
| `tokens-output` | output-token subtotal                          | yes                      |
| `tokens-cached` | cached-token subtotal (prompt-cache hits)      | yes                      |
| `input-speed`   | input tokens per second over the active window | yes                      |
| `output-speed`  | output tokens per second                       | yes                      |
| `total-speed`   | combined throughput                            | yes                      |

### Context (4)

| Type                        | Renders                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `context-length`            | tokens currently in the context window                             |
| `context-percentage`        | percentage of the model's context window in use                    |
| `context-percentage-usable` | percentage of usable context (excludes reserved-for-output budget) |
| `context-bar`               | tiny inline bar approximating context fill                         |

### Rate limits (5)

| Type                 | Renders                                                    | Required `options.reset` |
| -------------------- | ---------------------------------------------------------- | ------------------------ |
| `session-usage`      | percentage of the session quota consumed                   | yes                      |
| `block-reset-timer`  | time remaining until the next block resets                 | no                       |
| `block-reset-at`     | wall-clock of the next block reset (e.g. `resets 18:30`)   | no                       |
| `weekly-reset-timer` | time remaining until the weekly quota resets               | no                       |
| `weekly-reset-at`    | wall-clock of the next weekly reset (e.g. `week resets …`) | no                       |

### Git (12)

Git widgets activate only when the working directory is a git checkout;
otherwise they hide themselves. They share a single per-render snapshot
so a line with a dozen git widgets only spawns `git` once.

| Type               | Renders                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `git-branch`       | current branch (or short SHA when detached)                            |
| `git-sha`          | short commit SHA                                                       |
| `git-worktree`     | basename of the current worktree                                       |
| `git-changes`      | summary of insertions / deletions from `git diff --shortstat`          |
| `git-staged`       | staged-file count                                                      |
| `git-unstaged`     | unstaged-file count                                                    |
| `git-untracked`    | untracked-file count                                                   |
| `git-conflicts`    | merge-conflict file count                                              |
| `git-ahead-behind` | commits ahead of and behind upstream                                   |
| `git-upstream`     | upstream branch (`origin/main`)                                        |
| `git-origin-repo`  | repo segment of the `origin` remote URL                                |
| `git-pr`           | PR number / URL / title for HEAD's branch (opt-in network — see below) |

**`git-pr` and the no-network rule.** The render hot path (§1.2 N5)
forbids outbound calls. `git-pr` is the only widget that needs PR
metadata, which lives outside the local checkout, so it is gated:

- The widget hides unless `options.allowNetwork: true` is set.
- The actual network call lives in `src/git/pr.ts`'s `loadPullRequest`,
  which shells out to `gh pr view --json number,url,title`. It is
  invoked only when `loadGitSnapshot` is called with
  `allowPullRequest: true`. `loadGitSnapshot` is itself wired outside
  `renderFromInputs`, so the render path stays clean even when the
  widget is enabled.
- Any failure — `gh` not installed, no PR for the branch, response
  malformed, network timeout — silently yields `null` and the widget
  hides. There is no error surface on the statusline.
- Variants in the catalogue: `number` (`#42`, default), `url`,
  `title`, `number-title` (`#42 feat: do the thing`).

### Time (3)

| Type             | Renders                                            |
| ---------------- | -------------------------------------------------- |
| `clock`          | wall-clock time; `options.format` accepts strftime |
| `uptime-session` | session uptime (since Claude Code launch)          |
| `uptime-block`   | uptime of the active conversation block            |

### Layout / custom (1)

| Type        | Behaviour                                                                            |
| ----------- | ------------------------------------------------------------------------------------ |
| `separator` | a single user-defined glyph (`options.char`); honours `merged` like any other widget |

## Choosing widgets

A useful starting point is `templates/default.config.json`:

```json
{ "type": "model" },
{ "type": "git-branch" },
{ "type": "git-changes" },
{ "type": "context-percentage" },
{ "type": "tokens-total",  "options": { "reset": "block" } },
{ "type": "session-usage", "options": { "reset": "block" } },
{ "type": "block-reset-timer" },
{ "type": "clock" }
```

Three presets ship; `agentline config init --preset <name>` scaffolds the
user config from one:

- `minimal` — `model`, `context-length`, `block-reset-timer` (`templates/minimal.config.json`);
- `default` — the balanced bar above (`templates/default.config.json`);
- `maximal` — `default` plus `git-ahead-behind` and `weekly-reset-timer`.

## Editing a config

The friendliest path is the **TUI editor** — `agentline config` — which
shows a live preview of the bar as you add, reorder, replace, hide, and
re-space widgets (see [keymap.md](./keymap.md)).

For scripted edits, the **`agentline config widget`** subcommands operate
on the user config directly (load → mutate → validate → atomic write):

```bash
agentline config widget list [--json]                 # the current layout
agentline config widget catalog [--json] [--preview]  # every widget type; --preview shows what each renders
agentline config widget add <type> [--line N] [--at I] [--options JSON]
agentline config widget remove [--line N] --at I
agentline config widget move [--from-line N] --from-at I [--to-line M] [--to-at J]
agentline config widget replace <type> [--line N] --at I [--options JSON]
agentline config widget set-option <key> <value> [--line N] --at I [--json]
```

Either way, edits land on `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`;
the rendered statusline picks them up on the next prompt (no restart).

## Previewing a config offline

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
