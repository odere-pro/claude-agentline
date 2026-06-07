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
  "type": "tokens",
  "options": { "reset": "block" },
  "fg": "yellow",
  "merged": "merge"
}
```

Only `type` is required. Everything else falls back to the role
defaults from the active theme (see [themes.md](./themes.md)) or to the
widget's own defaults.

## Reset axes

Token and rate-limit widgets always declare a `reset`
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

34 widgets ship in v0.3.x, organised into five families. The
authoritative registry is `src/widgets/registry/registry.ts`; this page tracks
it.

### Session (17)

Surface state from the stdin payload that Claude Code emits.

| Type               | Renders                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `model`            | the active model id (e.g. `Sonnet 4.6`)                              |
| `version`          | Claude Code version                                                  |
| `session-id`       | short session id                                                     |
| `account-email`    | logged-in account email                                              |
| `thinking-effort`  | thinking-effort tier (low / medium / high)                           |
| `thinking-enabled` | whether extended thinking is on (`thinking` / `no-thinking`)         |
| `plan`             | active plan name (newest file in plans dir)                          |
| `project`          | project name — git repo (origin) or working-dir folder               |
| `project-dir`      | launch-directory basename (the dir the host started in)              |
| `cwd-path`         | current working-directory path, home-collapsed and truncatable       |
| `added-dirs`       | count of extra `/add-dir` workspace roots (e.g. `+2 dirs`)           |
| `agent-name`       | active subagent persona name                                         |
| `clock`            | current time of day (24h `HH:MM` or 12h `H:MMam`)                    |
| `output-style`     | active output style (e.g. `explanatory`, `learning`)                 |
| `vim-mode`         | active vim mode (`NORMAL`, `INSERT`, …)                              |
| `session-duration` | host-reported session elapsed time (e.g. `12m 30s`)                  |
| `lines-changed`    | host-reported lines added and removed this session (e.g. `+156 −23`) |

Auth-file fallback: when the stdin payload omits the account email,
`account-email` transparently re-reads `${CLAUDE_CONFIG_DIR}/.credentials.json`
so the line is never blank for an authenticated user.

### Tokens (4)

| Type            | Renders                                           | Required `options.reset` |
| --------------- | ------------------------------------------------- | ------------------------ |
| `tokens`        | input ↓ and output ↑ subtotals (`↓<in> · ↑<out>`) | yes                      |
| `tokens-cached` | cached-token subtotal (prompt-cache hits)         | yes                      |
| `token-speed`   | input ↓ and output ↑ tokens per second (rolling)  | no — uses `windowSec`    |
| `cost-usd`      | host-reported session cost in USD (e.g. `$1.23`)  | no                       |

`tokens` and `token-speed` take optional `inputGlyph` / `outputGlyph`
(defaults `↓` / `↑`). `token-speed` takes `windowSec` (default 60,
clamped 1–3600) instead of a reset axis.

### Context (2)

| Type                 | Renders                                             |
| -------------------- | --------------------------------------------------- |
| `context-percentage` | percentage of the model's context window used       |
| `context-200k-flag`  | a `>200k` badge when the prompt crosses 200k tokens |

`context-percentage` appends the current model's context-window size as a
postfix — e.g. `37% · 200k` (`1M` for the 1M-token model variants). The
postfix is omitted when the window size is unknown (synthetic fallback).
It resolves usage through three sources in priority order:

1. **`context_window.current_usage` from stdin.** The sum
   `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`
   divided by `context_window_size`. This is the source Claude Code
   itself uses in its UI, so the widget agrees with the host.
2. **`context_window.used_percentage` from stdin.** When the host
   reports only a pre-computed ratio, the widget synthesises a
   `{ used, window }` pair so the percentage still produces a
   meaningful number (the synthetic window is too small to surface a
   size postfix, so that is dropped).
3. **Local transcript aggregate.** Legacy fallback for hosts that
   don't ship `context_window` on stdin.

### Rate limits (3)

Mirrors the host's usage-limits screen: one combined current-session +
weekly usage cell, and two timer widgets that carry both countdown and
wall-clock (absolute-time) variants. All three read Claude Code's own
`rate_limits` block off stdin, so they match what you see on the host's
`/usage` screen. The usage widget reads `used_percentage` and includes
whichever window the host ships, hiding only when **neither** is present
(older Claude Code, fixtures with no usage data) — there is no
transcript-derived fallback, which would over-count and disagree with
the host. The timer widgets read `resets_at` and **fall back** to a
local estimate when the host omits it, so they still render on older
Claude Code.

| Type                          | Renders                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `session-weekly-usage`        | combined session + weekly usage % — `52% · weekly 33%`             |
| `current-session-reset-timer` | time to the next session reset (`rate_limits.five_hour.resets_at`) |
| `week-limit-timer`            | time to the next weekly reset (`rate_limits.seven_day.resets_at`)  |

**Wall-clock variants.** Both timer widgets double as wall-clock
(absolute-time) widgets when `options.format` is set to a clock-format
string — any format that is not a duration keyword (`short`, `long`,
`clock`, `compact`). Set `format` to a wall-clock token string and the
widget renders the absolute reset time instead of the countdown:

| Widget                        | Format string   | Example output            |
| ----------------------------- | --------------- | ------------------------- |
| `current-session-reset-timer` | `"HH:mm"`       | `resets 18:30`            |
| `current-session-reset-timer` | `"h:mma"`       | `resets 6:30pm`           |
| `current-session-reset-timer` | `"HH:mm:ss"`    | `resets 18:30:45`         |
| `week-limit-timer`            | `"EEE D HH:mm"` | `week resets Mon 5 00:00` |
| `week-limit-timer`            | `"HH:mm"`       | `week resets 00:00`       |
| `week-limit-timer`            | `"h:mma"`       | `week resets 12:00am`     |

The picker lists these as pre-built variants (`at-24h`, `at-12h`,
`at-seconds` for the session timer; `at-day-time`, `at-24h`, `at-12h`
for the week timer).

`session-weekly-usage` renders both windows as `52% · weekly 33%`,
dropping a half when the host omits that window (session-only → `52%`,
weekly-only → `weekly 33%`). A plan name is prefixed when present — a
host-provided `plan` field if Claude Code ever ships one, else the
configured `options.plan` (e.g. `{ "plan": "Max" }` →
`Max 52% · weekly 33%`). Out of the box there is no prefix.

The timer widgets prefer the host's `rate_limits.*.resets_at` and only
fall back to a local estimate when Claude Code doesn't ship it. The
weekly fallback defaults to a local **Monday 00:00** reset;
`options.resetWeekday` (`0`=Sunday … `6`=Saturday) and
`options.resetHour` (`0`–`23`, minutes fixed at `00`) pin **that
fallback only** — when the host ships `resets_at`, it wins regardless.
Example: `{ "resetWeekday": 4, "resetHour": 12 }` keeps a Thursday-12:00
estimate for older Claude Code. A stale (past) host reset renders `0m`
for the countdown variants and the past wall-clock for the at-\* variants,
self-correcting on the next render.

### Git (8)

Git widgets activate only when the working directory is a git checkout;
otherwise they hide themselves. They share a single per-render snapshot
so a line with several git widgets only spawns `git` once.

| Type               | Renders                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `git-branch`       | current branch (or short SHA when detached)                            |
| `git-worktree`     | basename of the current worktree                                       |
| `git-changes`      | summary of insertions / deletions from `git diff --shortstat`          |
| `git-conflicts`    | merge-conflict file count                                              |
| `git-ahead-behind` | commits ahead of and behind upstream                                   |
| `git-upstream`     | upstream branch (`origin/main`)                                        |
| `git-origin-repo`  | repo segment of the `origin` remote URL                                |
| `git-pr`           | PR number / URL / title for HEAD's branch (opt-in network — see below) |

**`git-pr` and the no-network rule.** The render hot path (§1.2 N5)
forbids outbound calls. `git-pr` is the only widget that needs PR
metadata, which lives outside the local checkout, so it is gated:

- The widget hides unless `options.allowNetwork: true` is set.
- The actual network call lives in `src/data/git/pr/pr.ts`'s `loadPullRequest`,
  which shells out to `gh pr view --json number,url,title`. It is
  invoked only when `loadGitSnapshot` is called with
  `allowPullRequest: true`. `loadGitSnapshot` is itself wired outside
  `renderFromInputs`, so the render path stays clean even when the
  widget is enabled.
- Any failure — `gh` not installed, no PR for the branch, response
  malformed, network timeout — silently yields `null` and the widget
  hides. There is no error surface on the statusline.
- Variants in the catalogue: `number` (`#42`, default), `url`,
  `title`, `number-title` (`#42 · feat: do the thing`).

## Choosing widgets

A useful starting point is `templates/default.config.json`:

```json
"lines": [
  { "widgets": [
    { "type": "model" }, { "type": "thinking-effort" },
    { "type": "git-branch" }, { "type": "git-changes" }
  ] },
  { "widgets": [
    { "type": "context-percentage" },
    { "type": "tokens", "options": { "reset": "block" } }
  ] },
  { "widgets": [
    { "type": "session-weekly-usage" },
    { "type": "current-session-reset-timer" },
    { "type": "week-limit-timer" }
  ] }
]
```

`agentline install` seeds the user config from
`templates/default.config.json` (the three-line bar above) on first run.

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

For deterministic offline replay (golden-snapshot harness, doctor's D08 check, CI), use the fixture path:

```bash
agentline render --fixture <path-to-stdin.json>            # replay a recorded payload
agentline render --fixture payload.json --config alt.json  # replay against a different config
```

`agentline render --fixture` is the goldens / replay surface.

Three reference fixtures ship under `tests/golden/`:

| Fixture                      | What it exercises                   |
| ---------------------------- | ----------------------------------- |
| `tests/golden/minimal/`      | a single-line `model`-only config   |
| `tests/golden/no-color/`     | accessibility — `--no-color` output |
| `tests/golden/powerline-on/` | Powerline transform with chevrons   |

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
