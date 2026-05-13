---
description: Agentline configuration sub-skill. Use when the user wants to change statusline widgets, layout, or theme. Covers config file path, the TUI editor, JSON structure, and env-var overrides.
---

# agentline — configure skill

Use this skill when the user wants to change what appears on their statusline, adjust layout, or edit any config setting.

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
agentline edit                                # interactive TUI editor (live preview, widget picker)
agentline init                                # write the default user config (refuses overwrite)
agentline init --force                        # reset the user config to the default
agentline keys [--json]                       # list the editor keymap
```

Config edits take effect on the **next prompt render** — Claude Code re-invokes the statusline bin every prompt — so no restart is needed. (`agentline install` is the only thing that needs a restart, to wire the `statusLine` key.)

---

## Editing widgets

Use `agentline edit` to open the interactive TUI editor — it is the primary surface for adding, reordering, recolouring, and toggling widgets with live preview. The editor writes the merged config atomically.

For mechanical edits without the TUI, hand-edit the JSON file directly; the bin validates on next load and falls back to defaults on a parse error rather than failing the render.

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
AGENTLINE_THEME=claude-code-dark
AGENTLINE_GLOBAL_PADDING=2
AGENTLINE_POWERLINE_ENABLED=true
```

Dot-path in `UPPER_SNAKE_CASE`, prefixed `AGENTLINE_`.

---

## Reset

No dedicated reset command — use `init --force`:

```bash
agentline init --force
```

Full reference → [config.md](../docs/config.md)
