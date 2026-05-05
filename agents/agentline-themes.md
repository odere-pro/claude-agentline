---
description: Agentline themes sub-skill. Use when the user wants to pick, preview, or author a statusline theme — browsing shipped themes, inspecting palette roles, creating a custom theme, or testing colour-depth degradation.
---

# agentline — themes skill

Use this skill when the user wants to pick, preview, or author a theme for their statusline.

---

## Browse and preview

```bash
agentline themes                          # swatch table: name + 13 palette colour blocks
agentline themes --show vscode-dark       # inspect one theme's full palette
agentline preview --all-themes            # render one live bar per theme, stacked
agentline preview --theme claude-code-dark  # pin a single theme
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
# 3. activate in config
agentline config   # or set "theme": "my-theme" in .claude/agentline.json

# 4. verify
agentline doctor
agentline preview --theme my-theme
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

Colour-depth detection is automatic. To test degradation:

```bash
NO_COLOR=1 agentline preview                           # no colour
COLORTERM= TERM=xterm-256color agentline preview       # 256-colour
```

agentline honours [`NO_COLOR`](https://no-color.org).

Full reference → [themes.md](../docs/themes.md)
