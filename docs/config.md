# Configuration

`agentline` is configured by a JSON file. The default template is
`templates/default.config.json` — model, git, context, tokens, session
usage, block reset timer, clock — and is what `agentline install`
seeds at `${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json` on
first run.

agentline is configured globally only — there is no per-project
config layer. An existing user config is preserved by `agentline
install`; to start fresh, delete the file and re-run `agentline
install`.

The canonical schema lives at `schemas/config.schema.json` and is also
embedded in the binary so validation works offline.

## File locations

agentline is configured globally only — there is no per-project
config layer. A `.agentline.json` in the cwd is silently ignored.

`agentline` reads configuration from up to four layered sources, in
this order (each later layer overrides the earlier ones):

1. **Built-in defaults** compiled into the binary.
2. **User config** at
   `${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json`.
3. **Environment variables** prefixed `AGENTLINE_` (dot-path mapping;
   see below).
4. **Command-line flags** (`--config <path>` overrides the user config
   path entirely).

Layer 2 is a partial overlay: a key absent in user config inherits the
built-in default. Arrays (`lines`, `lines[].widgets`) are replaced
wholesale, not merged element-by-element — same rule as JSON Patch.

## CLI commands

The quickest way to work with config without editing JSON by hand:

```bash
agentline edit                                # open the interactive TUI editor
```

To reset the config to the shipped default, delete the user config and
re-run the installer:

```bash
rm "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json"
agentline install
```

To see a config change in the live statusline, send Claude Code a new prompt — the renderer is invoked once per prompt, not by a watcher.

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

One non-config-leaf env var affects loader behaviour:

| Variable                    | Effect                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTLINE_TRANSCRIPT_ROOT` | Override the directory tree the transcript reader is allowed to resolve under (default: `~/.claude`). Test-only; production should leave unset. |

## Atomic writes

Every persisted config write — whether by `agentline edit` (TUI),
`scripts/install.sh`, or `agentline doctor --fix` — follows the same
recipe: write to a sibling temp file, `fsync`, then `rename` over the
target. Editor watchers observe one consistent state
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
