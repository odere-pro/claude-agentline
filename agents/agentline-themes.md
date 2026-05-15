---
description: Agentline themes sub-skill. Use when the user wants to pick, preview, or author a statusline theme — browsing shipped themes, inspecting palette roles, creating a custom theme, or testing colour-depth degradation.
---

# agentline — themes skill

Use this skill when the user wants to pick, preview, or author a theme for their statusline.

---

## Browse and inspect

To preview a theme live, set it in the config and restart the Claude Code session:

```jsonc
// ~/.config/agentline/config.json
{ "theme": "claude-code-dark" }
```

Or open the TUI editor to switch themes interactively:

```bash
agentline edit
```

---

## Shipped themes

| Name               | Base            |
| ------------------ | --------------- |
| `claude-code-dark` | dark warm brown |

Additional community themes can be dropped into
`${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes/<name>.json`
and referenced by name in your config.

---

## Palette roles

Required (every theme must supply all 13):

| Role          | Used by                                  |
| ------------- | ---------------------------------------- |
| `accent`      | session widgets (model, version, …)      |
| `info`        | context, tokens (low usage)              |
| `success`     | git clean state indicators               |
| `warning`     | context / tokens approaching their cap   |
| `danger`      | rate-limit hit, error states             |
| `muted`       | separators, labels in `minimalist` mode  |
| `git-clean`   | `git-changes` when the worktree is clean |
| `git-dirty`   | `git-changes` when the worktree is dirty |
| `tokens-low`  | token widgets (low usage)                |
| `tokens-mid`  | token widgets (medium usage)             |
| `tokens-high` | token widgets (high usage)               |
| `bg-section`  | section background areas                 |
| `bg-emphasis` | emphasis / highlight background areas    |

---

## Author a custom theme

```bash
# 1. copy the shipped theme into your user themes dir
cp themes/claude-code-dark.json \
  "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes/my-theme.json"

# 2. edit — rename the "name" field to match the filename
# 3. activate: set "theme": "my-theme" in ~/.config/agentline/config.json
#    (or open the TUI editor: `agentline edit`)

# 4. verify
agentline doctor
```

Minimal theme file shape:

```json
{
  "name": "my-theme",
  "palette": {
    "fg": "#d4d4d4",
    "bg": "#1e1e1e",
    "accent": "#569cd6",
    "warning": "#dcdcaa",
    "danger": "#f48771"
  }
}
```

Only the roles you set override; unset roles fall back to built-in defaults.

---

## Degraded terminals

Colour-depth detection is automatic. agentline honours [`NO_COLOR`](https://no-color.org); set it in the environment to disable colour. To test degradation, set `NO_COLOR=1` or `COLORTERM= TERM=xterm-256color` in the Claude Code session env and restart.

Full reference → [themes.md](../docs/themes.md)
