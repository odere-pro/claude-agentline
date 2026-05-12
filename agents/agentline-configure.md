---
description: Agentline configuration sub-skill. Use when the user wants to change statusline widgets, layout, presets, theme, or any config setting. Covers config file path, the TUI editor, presets, JSON structure, and env-var overrides.
---

# agentline — configure skill

Use this skill when the user wants to change what appears on their statusline, adjust layout, pick a preset, or edit any config setting.

---

## Config file location

agentline is configured globally only. The single source of truth is:

```text
${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json
```

There is no per-project config layer. A `.agentline.json` in the cwd is silently ignored.

---

## Quick commands

```bash
agentline config                              # interactive TUI editor (live preview, widget picker, options sheet)
agentline config init --preset default        # scaffold the user config
agentline config init --preset minimal        # scaffold a minimal user config
agentline config init --force --preset default  # reset the user config to defaults
agentline config theme                        # browse installed themes
agentline config theme --set vscode-dark      # switch the active theme
agentline config keys [--json]                # the editor keymap
agentline config schema --write .             # emit JSON Schema for editor support
```

Config edits take effect on the **next prompt render** — Claude Code re-invokes the statusline bin every prompt — so no restart is needed. (`agentline install` is the only thing that needs a restart, to wire the `statusLine` key.)

---

## Editing widgets from the CLI

`agentline config widget <sub>` mutates the user config directly (load → mutate → validate → atomic write) — the deterministic path for an in-session agent to make a precise edit without opening the TUI:

```bash
agentline config widget list [--json]                            # the current layout (lines + widgets, with indices)
agentline config widget catalog [--json] [--preview]             # every widget type; --preview shows what each renders
agentline config widget add <type> [--line N] [--at I] [--options JSON]    # insert a widget
agentline config widget remove [--line N] --at I                 # drop the widget at that position
agentline config widget move [--from-line N] --from-at I [--to-line M] [--to-at J]   # reorder
agentline config widget replace <type> [--line N] --at I [--options JSON]  # swap the widget at a position
agentline config widget set-option <key> <value> [--line N] --at I [--json]   # set one widget option
```

`--line` defaults to 0; `--at` defaults to the end of the line for `add`/`move`. Indices come from `agentline config widget list`. Errors (unknown type, out-of-range index, …) print to stderr and exit 2; success prints one confirmation line, leaving stdout parseable.

Prefer these over hand-editing the JSON when the change is mechanical — they validate the result and never leave a half-written file. For broad restructuring, hand-editing the file (atomically) is fine too.

---

## Presets

| Preset    | What's included                                             |
| --------- | ----------------------------------------------------------- |
| `minimal` | model, context-length, block-reset-timer (5h)               |
| `default` | model, git, context, tokens, cost, session-usage, clock     |
| `maximal` | default + thinking-effort, weekly-usage, weekly + 5h timers |

---

## Config structure (key options)

```jsonc
{
  "version": 1,
  "theme": "claude-code-dark",
  "lines": [
    {
      "widgets": [
        { "type": "model" },
        { "type": "git-branch" },
        { "type": "tokens-total", "options": { "reset": "block" } },
        { "type": "flex-separator" },
        { "type": "clock" },
      ],
    },
  ],
  "global": {
    "padding": 1, // spaces between widgets
    "separator": "|", // inter-widget separator character
    "minimalist": false, // strip labels globally
    "bold": false,
    "italic": false,
  },
}
```

Every widget accepts `label` (prefix text) and `rawValue: true` (suppress label). Full widget catalogue → [widgets.md](../docs/widgets.md)

---

## Environment variable overrides

Any config leaf can be overridden at runtime:

```bash
AGENTLINE_THEME=vscode-dark
AGENTLINE_GLOBAL_PADDING=2
AGENTLINE_POWERLINE_ENABLED=true
```

Dot-path in `UPPER_SNAKE_CASE`, prefixed `AGENTLINE_`.

---

## Reset

No dedicated reset command — use `config init --force`:

```bash
agentline config init --force --preset default
```

Full reference → [config.md](../docs/config.md)
