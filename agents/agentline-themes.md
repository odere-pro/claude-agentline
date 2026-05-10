---
description: Agentline themes sub-skill. Use when the user wants to pick, preview, or author a statusline theme — browsing shipped themes, inspecting palette roles, creating a custom theme, or testing colour-depth degradation.
---

# agentline — themes skill

Use this skill when the user wants to pick, preview, or author a theme for their statusline.

---

## Browse and inspect

```bash
agentline config theme                          # swatch table: name + 13 palette colour blocks
agentline config theme --show vscode-dark       # inspect one theme's full palette
```

To preview a theme live, set it in the config and restart the Claude Code session:

```jsonc
// ~/.config/agentline/config.json
{ "theme": "vscode-dark" }
```

---

## Shipped themes

| Name                | Base            |
| ------------------- | --------------- |
| `claude-code-dark`  | dark warm brown |
| `claude-code-light` | warm beige      |
| `vscode-dark`       | dark grey       |
| `vscode-light`      | light grey      |

Set in config:

```json
{ "theme": "vscode-dark" }
```

---

## Palette roles

| Role                | Used by                               |
| ------------------- | ------------------------------------- |
| `accent`            | session widgets (model, version, org) |
| `info`              | context, tokens at low usage          |
| `warning`           | context / tokens approaching cap      |
| `danger`            | rate-limit hit, error states          |
| `muted`             | separators, labels in minimalist mode |
| `git.clean`         | git widgets when worktree is clean    |
| `git.dirty`         | git widgets when worktree has changes |
| `cost.low/mid/high` | cost widget tiers                     |

---

## Author a custom theme

```bash
# 1. copy the closest preset to your user themes dir
cp themes/vscode-dark.json \
  "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/themes/my-theme.json"

# 2. edit — rename the "name" field to match the filename
# 3. activate: set "theme": "my-theme" in ~/.config/agentline/config.json
#    (or open the TUI editor: `agentline config`)

# 4. verify
agentline doctor
agentline config theme --show my-theme
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
