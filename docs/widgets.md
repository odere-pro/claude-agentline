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

Token, cost, and rate-limit widgets always declare a `reset` axis on
their `options`. Mixed-axis aggregation is forbidden — the renderer
rejects it with a schema error. Allowed values:

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

The catalogue below tracks the spec (§7). The status column reflects
what is wired in the current build.

> **Status legend:** `shipped` — registered, renders against live data.
> `stub` — accepted by the schema but currently renders a placeholder.
> Stubs become `shipped` over the v0.1.0 PR sequence; check
> `agentline themes --list` and the registry exposed by
> `src/widgets/index.ts` for the authoritative list in your build.

### Session

Surface state from the stdin payload that Claude Code emits.

| Type              | Renders                                          | Status  |
| ----------------- | ------------------------------------------------ | ------- |
| `model`           | the active model id (e.g. `Sonnet 4.6`)          | shipped |
| `version`         | Claude Code version                              | shipped |
| `output-style`    | active output style                              | shipped |
| `vim-mode`        | current vim mode when vim keybindings are active | shipped |
| `session-id`      | short session id                                 | shipped |
| `session-name`    | session name (or short id when unset)            | shipped |
| `account-email`   | logged-in account email                          | shipped |
| `login-method`    | auth method (oauth / api-key / device)           | shipped |
| `org`             | active organisation name                         | shipped |
| `thinking-effort` | thinking-effort tier (low / medium / high)       | shipped |
| `skills`          | skills attached to the session                   | shipped |

Auth-file fallback: when the stdin payload omits account / login fields,
session widgets transparently re-read `~/.claude/.credentials.json` so
the line is never blank for an authenticated user.

### Tokens & cost

| Type            | Renders                                                 | Required `options.reset` |
| --------------- | ------------------------------------------------------- | ------------------------ |
| `tokens-total`  | running token total                                     | yes                      |
| `tokens-input`  | input-token subtotal                                    | yes                      |
| `tokens-output` | output-token subtotal                                   | yes                      |
| `cost`          | running USD cost (per the embedded pricing table; §8.5) | yes                      |
| `session-usage` | aggregate session usage                                 | yes                      |
| `rate-limit`    | distance to the active rate limit                       | yes                      |

The pricing table is embedded at build time and refreshed via the
`pricing-skew.yml` workflow (see [doctor.md](./doctor.md#d07)). When
the table is older than 90 days, `doctor` reports D07.

### Context

| Type                 | Renders                                         |
| -------------------- | ----------------------------------------------- |
| `context-percentage` | percentage of the model's context window in use |
| `context-remaining`  | tokens remaining in the context window          |
| `context-bar`        | tiny inline bar approximating context fill      |

### Git

Activate only when the working directory is a git checkout; otherwise
the widget is hidden.

| Type               | Renders                                     |
| ------------------ | ------------------------------------------- |
| `git-branch`       | current branch (or short SHA when detached) |
| `git-changes`      | summary of staged / unstaged changes        |
| `git-ahead-behind` | commits ahead of and behind the upstream    |
| `git-stash`        | number of stash entries                     |

Git widgets fall back to a one-shot `git status --porcelain` when the
shipped libgit reader cannot satisfy the query — they never spawn a
git process per render unless they have to.

### Time

| Type     | Renders         | Notes                                              |
| -------- | --------------- | -------------------------------------------------- |
| `clock`  | wall-clock time | `options.format` accepts a `strftime`-style string |
| `uptime` | session uptime  |                                                    |

### Layout / custom

| Type             | Behaviour                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `separator`      | a single user-defined glyph (`options.char`); honours `merged` like any other widget                                       |
| `flex-separator` | absorbs all remaining space on the line; in Powerline mode it is silently dropped                                          |
| `command`        | runs `options.cmd` and renders stdout; cached for `options.ttlSeconds` (default `5`) — never network-bound, never blocking |

`command` widgets are the only built-in that spawn a child process.
The renderer enforces the TTL cache and a per-command timeout; doctor
check D09 verifies that every `cmd` resolves to an executable on PATH.

## Choosing widgets

A useful starting point is the `default.config.json` line:

```json
{ "type": "model" },
{ "type": "git-branch" },
{ "type": "git-changes" },
{ "type": "context-percentage" },
{ "type": "tokens-total", "options": { "reset": "block" } },
{ "type": "cost",         "options": { "reset": "block" } },
{ "type": "session-usage","options": { "reset": "block" } },
{ "type": "flex-separator" },
{ "type": "clock" }
```

For a leaner line — what `init.sh` writes — see
`templates/minimal.config.json`.

To preview what a config will render without restarting Claude Code:

```bash
agentline render --fixture path/to/payload.json --config /path/to/config.json
```

Recorded payloads live under `tests/fixtures/` once the render command
is fully wired.
