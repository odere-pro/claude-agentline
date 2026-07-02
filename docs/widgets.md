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

39 widgets ship, organised into six families. The
authoritative registry is `src/widgets/registry/registry.ts`; this page tracks
it.

### Session (11)

Surface state from the stdin payload that Claude Code emits.

| Type               | Renders                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `model`            | the active model id (e.g. `Sonnet 4.6`)                              |
| `version`          | Claude Code version                                                  |
| `session-id`       | short session id                                                     |
| `account-email`    | logged-in account email                                              |
| `thinking-effort`  | thinking-effort tier (low through max, plus ultracode)               |
| `thinking-enabled` | whether extended thinking is on (`thinking` / `no-thinking`)         |
| `plan`             | active plan name (newest file in plans dir)                          |
| `cwd-path`         | current working-directory path, home-collapsed and truncatable       |
| `agent-name`       | active subagent persona name                                         |
| `session-duration` | host-reported session elapsed time (e.g. `12m 30s`)                  |
| `lines-changed`    | host-reported lines added and removed this session (e.g. `+156 −23`) |

(`project` / `project-dir` moved to the **git** family; `clock` /
`added-dirs` / `output-style` / `vim-mode` moved to the **other** family.)

Emphasis variant: `thinking-effort` has an opt-in `emphasis` variant
(`options.emphasis: true`) that colour-ramps the tier — `low`→muted,
`medium`→info, `high`/`xhigh`→accent, `max`→success — and renders
`ultracode` in its own signature purple. (The host reports `xhigh` for
ultracode mode and does not emit `ultracode` as a level, so that purple is
forward-compat — recognised for the day the host exposes it.) The default
(non-variant) rendering stays flat in the session family accent, and the tier
name always stays in the text so `--no-color` remains legible.

Auth-file fallback: when the stdin payload omits the account email,
`account-email` transparently re-reads `${CLAUDE_CONFIG_DIR}/.credentials.json`
so the line is never blank for an authenticated user.

### Tokens (8)

| Type              | Renders                                             | Required `options.reset` |
| ----------------- | --------------------------------------------------- | ------------------------ |
| `tokens`          | input ↓ and output ↑ subtotals (`↓<in> · ↑<out>`)   | yes                      |
| `tokens-cached`   | cached-token subtotal (prompt-cache hits)           | yes                      |
| `token-speed`     | input ↓ and output ↑ tokens per second (rolling)    | no — uses `windowSec`    |
| `cost-usd`        | host-reported session cost in USD (e.g. `$1.23`)    | no                       |
| `cost-burn-rate`  | session spend rate, `$/hr` (e.g. `$1.20/hr`)        | no                       |
| `api-duration`    | API wait time (`2.3s`; `percent: true` → % of wall) | no                       |
| `cost-efficiency` | share of wall-clock spent in API calls, as a `%`    | no                       |
| `cost-vs-limit`   | spend against a `budget` (e.g. `$1.20/$5`)          | no — needs `budget`      |

`tokens` and `token-speed` take optional `inputGlyph` / `outputGlyph`
(defaults `↓` / `↑`). `token-speed` takes `windowSec` (default 60,
clamped 1–3600) instead of a reset axis. The five cost widgets read
host-provided scalars from the stdin `cost` block — they carry no reset
axis and hide when their source field is absent (`cost-burn-rate` /
`cost-efficiency` also hide on a zero wall-clock duration to avoid a
divide-by-zero). `cost-vs-limit` takes a required `budget` option (USD, a
positive number); it hides without it and signals the theme `danger` role
when spend reaches or exceeds the budget.

### Context (3)

| Type                 | Renders                                             |
| -------------------- | --------------------------------------------------- |
| `context-percentage` | percentage of the model's context window used       |
| `context-200k-flag`  | a `>200k` badge when the prompt crosses 200k tokens |
| `context-cached`     | session cached-token count (e.g. `0.8k cached`)     |

`context-percentage` appends the current model's context-window size as a
postfix — e.g. `37% · 200k` (`1M` for the 1M-token model variants). With
`options.showCached` (off by default) it inserts a cached segment —
`37% · 0.8k cached · 200k`; `context-cached` shows that same cached count
on its own cell, parallel to `tokens-cached`. The
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

### Rate limits (2)

Mirrors the host's usage-limits screen: one combined current-session +
weekly usage cell, and one combined reset-timer cell that shows BOTH the
session and weekly reset (countdown or wall-clock). Both read Claude
Code's own `rate_limits` block off stdin, so they match what you see on
the host's `/usage` screen. The usage widget reads `used_percentage` and
includes whichever window the host ships, hiding only when **neither** is
present (older Claude Code, fixtures with no usage data) — there is no
transcript-derived fallback, which would over-count and disagree with
the host. `reset-timer` reads `resets_at` and **falls back** to a local
estimate for the session window when the host omits it.

| Type                   | Renders                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `session-weekly-usage` | combined session + weekly usage % — `52% · weekly 33%`                   |
| `reset-timer`          | session + weekly reset on one cell — `reset in 1h 30m · weekly 3d 4h 0m` |

**Both windows, one `format`.** `reset-timer` replaces the former
`current-session-reset-timer` + `week-limit-timer`. A single
`options.format` drives both windows: a duration keyword (`short`,
`long`, `clock`, default `compact`) gives the countdown
(`reset in 1h 30m · weekly 3d 4h 0m`); a wall-clock token gives the
absolute reset time (`resets 18:30 · weekly Mon 17 00:00`):

| Format string | Example output                       |
| ------------- | ------------------------------------ |
| `"HH:mm"`     | `resets 18:30 · weekly Thu 7 12:00`  |
| `"h:mma"`     | `resets 6:30pm · weekly Thu 7 12:00` |
| `"HH:mm:ss"`  | `resets 18:30:45 · weekly …`         |

The session window uses the chosen token; the weekly window keeps its
day-aware default (`EEE D HH:mm`) when you leave the session default, and
follows the token when you pick a non-default one. The picker lists these
as pre-built variants (`short`, `long`, `clock`, `at-24h`, `at-12h`,
`at-seconds`).

`session-weekly-usage` renders both windows as `52% · weekly 33%`,
dropping a half when the host omits that window (session-only → `52%`,
weekly-only → `weekly 33%`). A plan name is prefixed when present — a
host-provided `plan` field if Claude Code ever ships one, else the
configured `options.plan` (e.g. `{ "plan": "Max" }` →
`Max 52% · weekly 33%`). Out of the box there is no prefix.

`reset-timer` prefers the host's `rate_limits.*.resets_at` and only
falls back to a local estimate for the session window when Claude Code
doesn't ship it. The weekly window renders from the host value, or from a
local **Monday 00:00** estimate when you pin one; `options.resetWeekday`
(`0`=Sunday … `6`=Saturday) and `options.resetHour` (`0`–`23`, minutes
fixed at `00`) pin **that fallback only** — when the host ships
`resets_at`, it wins regardless. Example: `{ "resetWeekday": 4, "resetHour": 12 }`
keeps a Thursday-12:00 weekly estimate for older Claude Code. A stale
(past) host reset renders `0m` for the countdown and the past wall-clock
for the at-\* variants, self-correcting on the next render.

### Git (11)

Git widgets activate only when the working directory is a git checkout;
otherwise they hide themselves. They share a single per-render snapshot
so a line with several git widgets only spawns `git` once. `project` and
`project-dir` sit here too — the project name is git-repo-derived.

| Type               | Renders                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `project`          | project name — git repo (origin) or working-dir folder                                  |
| `project-dir`      | launch-directory basename (the dir the host started in)                                 |
| `git-branch`       | current branch (or short SHA when detached)                                             |
| `git-worktree`     | basename of the current worktree                                                        |
| `git-changes`      | summary of insertions / deletions from `git diff --shortstat`                           |
| `git-conflicts`    | merge-conflict file count                                                               |
| `git-ahead-behind` | commits ahead of and behind upstream                                                    |
| `git-upstream`     | upstream branch (`origin/main`)                                                         |
| `git-origin-repo`  | repo segment of the `origin` remote URL                                                 |
| `git-pr`           | PR number / URL / title for HEAD's branch (host-provided by default — see below)        |
| `git-pr-review`    | PR review state for HEAD's branch — approved / changes-requested / etc. (host-provided) |

**`git-pr`, the host bridge, and the no-network rule.** The render hot
path (§1.2 N5) forbids outbound calls. PR metadata lives outside the
local checkout, so `git-pr` has two sources with different visibility:

- **Host-provided (default).** When Claude Code sends a PR on stdin
  (`pr.{number,url}`), the data is free — no subprocess, no latency. The
  widget renders it **without any opt-in**; `prSource` on the git snapshot
  is tagged `"host"`.
- **`gh` fallback (opt-in).** When the host sends no PR, the widget can
  fetch via `gh pr view --json number,url,title` (`src/data/git/pr/pr.ts`'s
  `loadPullRequest`), tagged `prSource: "network"`. This source renders
  **only** when `options.allowNetwork: true` is set — accepting the
  latency / privacy cost. `loadGitSnapshot` makes the `gh` call only when
  it sees that opt-in, and is wired outside `renderFromInputs`, so the
  render path stays clean.
- Any failure — `gh` not installed, no PR for the branch, response
  malformed, network timeout — silently yields `null` and the widget
  hides. There is no error surface on the statusline.
- Variants in the catalogue: `number` (`#42`, default), `url`,
  `title`, `number-title` (`#42 · feat: do the thing`).

### Other (4)

Miscellaneous host/editor signals that don't belong to a data-domain
family. Their render code still lives under `src/widgets/session/` —
only the catalogue family moved.

| Type           | Renders                                               |
| -------------- | ----------------------------------------------------- |
| `clock`        | current time of day (24h `HH:MM` or 12h `H:MMam`)     |
| `added-dirs`   | count of extra `/add-dir` workspace roots (`+2 dirs`) |
| `output-style` | active output style (e.g. `explanatory`, `learning`)  |
| `vim-mode`     | active vim mode (`NORMAL`, `INSERT`, …)               |

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
    { "type": "reset-timer" }
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
(the byte-for-byte expected output). A git-widget scenario may add an
optional `git.json` (a static `GitState` injected via `--git`) so the git
family renders deterministically with no real `git`/`gh`.

To regenerate a golden after an intentional renderer change (record under the
same env gate-12 pins, and add `--git` for a git scenario):

```bash
# Drop the `--git` line for a non-git scenario.
env NO_COLOR=1 AGENTLINE_GLYPHS=ascii TZ=UTC \
  agentline render --fixture tests/golden/<name>/stdin.json \
  --config tests/golden/<name>/config.json \
  --frozen-clock "$(cat tests/golden/<name>/clock.txt)" \
  --git tests/golden/<name>/git.json \
  --width 80 --no-color \
  > tests/golden/<name>/expected.ansi
```
