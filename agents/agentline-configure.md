---
description: Agentline configuration sub-skill. Use when the user wants to change statusline widgets, layout, presets, theme, or any config setting. Covers config file paths, the TUI editor, presets, JSON structure, and env-var overrides.
---

# agentline — configure skill

Use this skill when the user wants to change what appears on their statusline, adjust layout, pick a preset, or edit any config setting.

---

## Config file locations

| Scope   | Path                              | Precedence |
| ------- | --------------------------------- | ---------- |
| User    | `~/.config/agentline/config.json` | lower      |
| Project | `.claude/agentline.json`          | higher     |

Project config overrides user config key-by-key. Arrays (`lines`, `widgets`) replace wholesale.

---

## Quick commands

```bash
agentline config                                  # interactive TUI editor (recommended)
agentline init --preset default --scope project   # scaffold .claude/agentline.json
agentline init --preset minimal  --scope user     # scaffold user config
agentline init --force --preset default           # reset project config to defaults
agentline preview --config .claude/agentline.json # preview without a live session
agentline preview --watch                         # live-reload preview on config save
```

---

## Presets

| Preset    | What's included                                                |
| --------- | -------------------------------------------------------------- |
| `minimal` | model, git-branch, clock                                       |
| `default` | model, git-branch, context, tokens, cost, session-usage, clock |
| `focus`   | model, git-branch, context-percentage, clock                   |
| `power`   | default + thinking-effort, weekly-usage, block-timer           |

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

No dedicated reset command — use `init --force`:

```bash
agentline init --force --preset default --scope project
agentline init --force --preset default --scope user
```

Full reference → [config.md](../docs/config.md)
