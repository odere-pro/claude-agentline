# Configuration

`agentline` is configured by a JSON file. Four shipped presets are
available via `agentline config init --preset <name>`:

- **`minimal`** (`templates/minimal.config.json`) — model, git-branch, clock. The smallest sensible bar.
- **`default`** (`templates/default.config.json`) — model, git, context, tokens, cost, session usage, clock. The recommended starting point; what `scripts/install.sh` seeds on first run.
- **`focus`** (`templates/presets/focus.config.json`) — model, git, context-percentage, clock. The "I'm trying to read code" bar.
- **`power`** (`templates/presets/power.config.json`) — full default plus `thinking-effort`, `weekly-usage`, `block-timer`. Everything.

`agentline config init` defaults to the `default` preset and writes
`.claude/agentline.json` in the current directory; pass `--scope user` to
write the user config instead, or `--target <path>` for an explicit
location. Existing targets are preserved unless `--force` is passed.

The canonical schema lives at `schemas/config.schema.json` and is also
embedded in the binary so validation works offline. To drop a copy into
your editor:

```bash
agentline config schema --write .vscode/
```

## File locations

`agentline` reads configuration from up to three layered sources, in
this order (each later layer overrides the earlier ones):

1. **Built-in defaults** compiled into the binary.
2. **User config** at
   `${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json`.
3. **Project config** at `${CLAUDE_PROJECT_DIR:-$PWD}/.agentline.json`,
   when the file is present. The project layer silently drops
   `command` widgets unless
   `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS=1` is set in the
   environment — see [widgets.md](./widgets.md) for the rationale.
4. **Environment variables** prefixed `AGENTLINE_` (dot-path mapping;
   see below).
5. **Command-line flags** (`--config <path>` overrides the user config
   path entirely).

Layers 2 and 3 are partial overlays: a key absent at the project layer
inherits the user value; a key absent at both layers inherits the
built-in default. Arrays (`lines`, `lines[].widgets`) are replaced
wholesale, not merged element-by-element — same rule as JSON Patch.

## CLI commands

The quickest way to work with config without editing JSON by hand:

```bash
agentline config                                           # open the interactive TUI editor
agentline config init --preset default --scope project     # scaffold .claude/agentline.json
agentline config init --preset minimal --scope user        # scaffold user config
agentline config init --force --preset default             # reset the project config to defaults
agentline config schema --write .vscode/                   # drop the JSON schema for editor autocomplete
```

To see a config change in the live statusline, restart the Claude Code session — the renderer is invoked once per prompt by Claude Code, not by a watcher.

Full flag reference for all commands → [cli.md](./cli.md)

---

## Top-level shape

```json
{
  "$schema": "https://github.com/odere-pro/claude-agentline/schemas/config.schema.json",
  "version": 1,
  "theme": "claude-code-dark",
  "lines": [{ "widgets": [{ "type": "model" }, { "type": "clock" }] }],
  "global": { "padding": 1, "separator": "|" },
  "powerline": { "enabled": false },
  "terminalWidth": { "mode": "full-minus-40", "compactThreshold": 60 },
  "keymap": {}
}
```

| Key             | Type           | Default                  | Notes                                                                                                                  |
| --------------- | -------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `$schema`       | string         | the canonical schema URL | optional; lets editors auto-complete                                                                                   |
| `version`       | int            | `1`                      | schema version; older files are auto-migrated, newer files are refused with a structured error and a `.bak` is written |
| `theme`         | string \| null | `null`                   | named theme from `themes/` (see [themes.md](./themes.md))                                                              |
| `lines`         | array          | one default line         | ordered top-to-bottom; one or more                                                                                     |
| `global`        | object         | see below                | global render options                                                                                                  |
| `powerline`     | object         | `{ "enabled": false }`   | Powerline mode options                                                                                                 |
| `terminalWidth` | object         | `full-minus-40`          | width-detection mode                                                                                                   |
| `keymap`        | object         | `{}`                     | keybinding overrides for `agentline config`                                                                            |

### `lines`

Each line is an object with a single key, `widgets`, that holds an
ordered array of widget definitions. A line MUST contain at least one
widget. Lines render top-to-bottom in declaration order. The renderer
truncates beyond available rows and emits a `truncated` warning to
stderr.

### `global`

| Key             | Type           | Default | Notes                                                              |
| --------------- | -------------- | ------- | ------------------------------------------------------------------ |
| `padding`       | int            | `1`     | spaces between widgets in non-Powerline mode                       |
| `separator`     | string         | `\|`    | default inter-widget separator                                     |
| `inheritColors` | bool           | `false` | a widget without explicit colour inherits from the previous widget |
| `bold`          | bool           | `false` | apply bold globally                                                |
| `italic`        | bool           | `false` | apply italic globally                                              |
| `minimalist`    | bool           | `false` | strip widget labels globally; per-widget `rawValue` still wins     |
| `overrideFg`    | colour \| null | `null`  | force foreground colour                                            |
| `overrideBg`    | colour \| null | `null`  | force background colour                                            |

### `terminalWidth`

| Key                | Type | Default         | Notes                                                |
| ------------------ | ---- | --------------- | ---------------------------------------------------- |
| `mode`             | enum | `full-minus-40` | one of `full`, `full-minus-40`, `full-until-compact` |
| `compactThreshold` | int  | `60`            | columns below which the renderer switches to compact |

### `powerline`

See [themes.md](./themes.md#powerline) for the full Powerline shape.
With `"enabled": false` (the default) the inter-widget `separator` and
`padding` from `global` are honoured; with `"enabled": true` they are
ignored and chevron glyphs are used instead.

## Widget shape

```json
{
  "type": "git-branch",
  "id": "branch-1",
  "fg": "blue",
  "bg": null,
  "bold": false,
  "italic": false,
  "rawValue": false,
  "merged": "off",
  "hidden": false,
  "options": { "format": "short" }
}
```

Only `type` is required. Colours accept three forms:

- A named colour: `black`, `red`, `green`, `yellow`, `blue`, `magenta`,
  `cyan`, `white`, plus their `bright-*` variants.
- A 256-colour index: `"colour:NNN"` where `0 ≤ NNN ≤ 255`.
- A truecolor hex: `"#RRGGBB"`.

Anything else is a schema error and the renderer falls back to the role
default.

`merged` controls the boundary with the previous widget:

| Value              | Behaviour                                 |
| ------------------ | ----------------------------------------- |
| `off`              | default; padding + separator on each side |
| `merge`            | one space, no separator                   |
| `merge-no-padding` | zero space, no separator                  |

The full per-type `options` catalogue lives in [widgets.md](./widgets.md).

## Environment variables

Every leaf key in the config can be overridden by an environment
variable named `AGENTLINE_` followed by the dot-path in
`UPPER_SNAKE_CASE`. Examples:

```bash
AGENTLINE_GLOBAL_PADDING=2
AGENTLINE_THEME=vscode-dark
AGENTLINE_POWERLINE_ENABLED=true
```

Values are parsed as JSON when they look like JSON literals (`true`,
`false`, numbers, quoted strings) and otherwise treated as plain
strings. Setting an env var to the empty string clears the override.
JSON values have `__proto__` / `constructor` / `prototype` keys
stripped recursively before merge, so a malicious env layer cannot
mutate `Object.prototype`.

Two non-config-leaf env vars that affect loader behaviour:

| Variable                                  | Effect                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTLINE_TRUST_PROJECT_COMMAND_WIDGETS` | Set to `1` to opt in to `command` widgets sourced from the project layer (`.agentline.json`). Otherwise project-layer `command` widgets are dropped before merge and a one-line warning is emitted to stderr. |
| `AGENTLINE_TRANSCRIPT_ROOT`               | Override the directory tree the transcript reader is allowed to resolve under (default: `~/.claude`). Test-only; production should leave unset.                                                               |

## Atomic writes

Every persisted config write — whether by `agentline config` (TUI),
`agentline config init`, `scripts/install.sh`, or `agentline doctor --fix` —
follows the same recipe: write to a sibling temp file, `fsync`, then
`rename` over the target. Editor watchers observe one consistent state
and an interrupted write never leaves a half-written file.

When the binary auto-migrates a config from an older schema version, it
writes the migrated copy to disk via the same atomic recipe and saves
the previous bytes to a `.bak` sibling. An older binary that
encounters a newer schema version refuses to run (exit code 2) with a
structured error rather than guessing.

## Validation

The merged config is validated against the embedded schema at every
load. Validation errors exit with code 2 and a JSON-pointer-style
location:

```text
agentline: config error at /lines/0/widgets/2/type: must be a known widget type
```

Run `agentline doctor` for a friendlier report that resolves the
location to a line number in your config file.
