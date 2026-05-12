# Themes

A theme is a JSON file that maps semantic role names (`accent`, `info`,
`warning`, …) to terminal colours. Every widget asks the theme for the
colour of the role it belongs to; an explicit `fg` / `bg` on the
widget itself wins over the theme.

## File shape

```json
{
  "$schema": "https://github.com/odere-pro/claude-agentline/schemas/theme.schema.json",
  "name": "vscode-dark",
  "palette": {
    "fg": "#d4d4d4",
    "bg": "#1e1e1e",
    "accent": "#569cd6",
    "info": "#9cdcfe",
    "warning": "#dcdcaa",
    "danger": "#f48771",
    "muted": "#808080"
  },
  "powerline": {
    "caps": { "start": "", "end": "" }
  }
}
```

Validate against `schemas/theme.schema.json`. The `name` field MUST be
kebab-case and MUST match the filename (`vscode-dark` → `vscode-dark.json`).

Colour values accept the same three forms as widget colours
(see [config.md](./config.md#widget-shape)):

- A named colour: `black`, `red`, …, `bright-white`.
- A 256-colour index: `"colour:NNN"`.
- A truecolor hex: `"#RRGGBB"`.

## Where themes live

- **Shipped** — `themes/` in this repo and in the published tarball.
  These are the four presets below. `scripts/install.sh` copies them
  into the user themes directory.
- **User** —
  `${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes/<name>.json`.
  Files here override shipped themes of the same name.

## Shipped presets

Each swatch shows the 13 palette roles left to right (accent → info → success → warning → danger → muted → git-clean → git-dirty → tokens-low → tokens-mid → tokens-high → bg-section → bg-emphasis). Hover a square to see the role name.

| Name                | Base            | Palette                                                                              |
| ------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `claude-code-dark`  | dark warm brown | <img src="themes/claude-code-dark.svg" alt="claude-code-dark palette" height="16">   |
| `claude-code-light` | warm beige      | <img src="themes/claude-code-light.svg" alt="claude-code-light palette" height="16"> |
| `vscode-dark`       | dark grey       | <img src="themes/vscode-dark.svg" alt="vscode-dark palette" height="16">             |
| `vscode-light`      | light grey      | <img src="themes/vscode-light.svg" alt="vscode-light palette" height="16">           |

To browse and inspect themes:

```bash
agentline config theme                         # swatch table — name + 13 palette blocks per theme
agentline config theme --list                  # tab-separated name<TAB>path (for scripts and CI)
agentline config theme --show vscode-dark      # pretty-print the resolved palette
```

`agentline config theme` (no flags) prints one row per theme with a swatch
of all 13 palette roles rendered through the same ANSI encoder the
statusline uses, so what you see in the table is what you get on the
bar.

To activate a theme, set `"theme": "<name>"` in your config (or use the TUI editor with `agentline config`) and restart your Claude Code session.

## Palette roles

Built-in widgets ask the active theme for these roles. Widgets that
don't declare a role fall back to `fg` / `bg`.

| Role                                  | Used by                                         |
| ------------------------------------- | ----------------------------------------------- |
| `fg`                                  | default foreground when no widget colour is set |
| `bg`                                  | default background                              |
| `accent`                              | session widgets (`model`, `version`, `org`)     |
| `info`                                | context, tokens (low usage)                     |
| `warning`                             | context / tokens approaching their cap          |
| `danger`                              | rate-limit hit, error states                    |
| `muted`                               | separators, labels in `minimalist` mode         |
| `git.branch`                          | `git-branch`                                    |
| `git.dirty`                           | `git-changes` when the worktree is dirty        |
| `git.clean`                           | `git-changes` when the worktree is clean        |
| `cost.low` / `cost.mid` / `cost.high` | `cost` widget tiers                             |
| `clock`                               | `clock`, `uptime`                               |

Themes can supply a subset of the role keys; missing roles fall back to
the in-code defaults so an old theme keeps working when new widgets
ship.

## Authoring a theme

1. Copy the closest preset:

   ```bash
   cp themes/vscode-dark.json \
     "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes/my-theme.json"
   ```

2. Rename `name` to match the filename (`my-theme`).
3. Edit colours.
4. Activate it by setting `theme: "my-theme"` in your config.
5. Run `agentline doctor` to verify the file validates.

Atomic writes apply to user-authored themes too: prefer `cp` /
your editor's atomic-save over piping into the file in place.

## Powerline

Powerline mode is opt-in and lives under the top-level `powerline` key
in your config (not in the theme file). Powerline themes can carry
their own `caps` glyphs which override the in-config defaults when the
theme is active.

```json
"powerline": {
  "enabled": true,
  "theme": null,
  "caps":   { "start": "", "end": "" },
  "autoAlign": false,
  "continueColors": false,
  "glyphs": {
    "hardRight": "",
    "softRight": "",
    "hardLeft":  "",
    "softLeft":  ""
  }
}
```

When `enabled` is `true`:

- The inter-widget `separator` and `padding` from `global` are ignored;
  the chevron glyphs above are inserted instead.
- Adjoining colours are computed automatically: the chevron's
  foreground is the previous widget's background, and its background
  is the next widget's background.
- `flex-separator` is silently dropped — Powerline lines are
  right-padded by `autoAlign` instead.
- Without a Nerd Font installed, `agentline doctor` emits the D05
  warning and the binary falls back to ASCII chevrons (`>`, `<`).

## Truecolor and degraded terminals

Colour-depth detection is automatic (per `$COLORTERM`, `$TERM`, and
`$NO_COLOR`). If the terminal advertises only 256 colours, hex values
are quantised to the nearest 256-colour index; if the terminal
advertises 16 or none, they are quantised to the nearest named colour.
Set `NO_COLOR=1` to disable colours entirely; agentline honours the
[no-color.org](https://no-color.org) convention.

To preview how a theme degrades on a 256-colour host, use the fixture-replay path:

```bash
COLORTERM= TERM=xterm-256color agentline render --fixture demo.json
```
