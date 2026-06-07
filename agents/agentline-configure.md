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
agentline config refresh                      # print the current refresh cadence (seconds)
agentline config refresh <seconds>            # set it (integer >= 0; 0 disables); re-syncs settings.json
agentline config undo                         # roll back the last config change (single-level)
```

`config undo` restores the prior config from `config.json.bak`, which
every config-writing path (a `config widget` mutation or a TUI editor
save) writes before the new config lands. It is single-level — it
restores one step back, not a multi-level history — and exits non-zero
with a `nothing to undo` message when there is no backup yet.

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
        { "type": "tokens", "options": { "reset": "block" } },
        { "type": "version" },
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

## Refresh interval

`refreshInterval` (top-level, integer seconds, default `5`) is the
wall-clock cadence at which the statusline re-renders. agentline's
config is the source of truth; the value is mirrored 1:1 into Claude
Code's `~/.claude/settings.json` `statusLine.refreshInterval` at
`agentline install` / `agentline reset`, by `agentline config refresh`,
and by `agentline doctor --fix` (check **D09**). It keeps time-based
widgets (durations, rate-limit countdowns, git state from background
subagents) advancing while the session is idle.

`0` disables it — the field is omitted from settings.json and Claude
Code reverts to event-driven updates only; `1`+ is written through.
There is no env-var override for this key (the env layer cannot
address a camelCase top-level key); use `agentline config refresh` or
the TUI/JSON. The render path never writes settings.json.

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

`agentline reset` restores the default config. It overwrites the user config with the shipped default template (the bare installer would preserve an existing config), re-seeds themes and skills, and ensures `statusLine` is wired:

```bash
agentline reset
```

Full reference → [config.md](../docs/config.md)
