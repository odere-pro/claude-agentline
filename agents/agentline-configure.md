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
agentline config                              # interactive TUI editor
agentline config init --preset default        # scaffold the user config
agentline config init --preset minimal        # scaffold a minimal user config
agentline config init --force --preset default  # reset the user config to defaults
agentline config theme                        # browse installed themes
agentline config schema --write .             # emit JSON Schema for editor support
```

For routine edits the in-session agent should write the config file directly (atomically) — no command needed. Restart the Claude Code session to see the change.

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
