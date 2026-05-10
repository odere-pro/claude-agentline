---
description: Agentline onboarding sub-skill. Use when the user has just run `agentline install` and asks "what now?", "how do I customize this?", or wants a guided first-time tour without leaving the Claude Code session.
---

# agentline — onboarding skill

Use this skill when the user just ran `agentline install` and wants a quick tour of what they can do next, all from inside their Claude Code session.

The flow is short on purpose:

1. confirm the statusline is rendering
2. switch theme
3. add or remove a widget
4. roll back if they don't like it

For each step, delegate to a focused sub-skill rather than duplicating its content here.

---

## Step 1 — confirm it's wired

After `agentline install` and a session restart, the statusline appears at the bottom of the Claude Code prompt. If it's blank or missing:

```bash
agentline doctor          # full health report
agentline doctor --fix    # auto-repair D01–D04
```

Deeper diagnosis → `/agentline-troubleshoot`.

---

## Step 2 — switch the theme

Four themes ship today: `claude-code-dark`, `claude-code-light`, `vscode-dark`, `vscode-light`.

Set the `theme` field in the user config:

```jsonc
// ~/.config/agentline/config.json
{
  "theme": "vscode-dark",
}
```

Or browse what's installed first:

```bash
agentline config theme              # swatch table for all themes
agentline config theme --show vscode-dark
```

The change shows on the next session restart. Deeper theme work → `/agentline-themes`.

---

## Step 3 — add or remove a widget

Widgets live in the `lines[].widgets[]` array of the config file. Common asks:

```jsonc
// ~/.config/agentline/config.json — add a context-percentage widget
{
  "lines": [
    {
      "widgets": [
        { "type": "model" },
        { "type": "git-branch" },
        { "type": "context-percentage" }, // <-- added
        { "type": "flex-separator" },
        { "type": "clock" },
      ],
    },
  ],
}
```

Full widget catalogue and field-by-field config → `/agentline-configure` and [widgets.md](../docs/widgets.md).

---

## Step 4 — roll back

```bash
agentline uninstall          # restores the prior statusLine, removes installed skills
agentline uninstall --purge  # also removes user config + custom themes
```

The prior `statusLine` was backed up at install time. Uninstall restores it from `~/.config/agentline/state/settings-backup.json`.

---

## Quick reference

| Want to                         | Do                                               |
| ------------------------------- | ------------------------------------------------ |
| See if it's working             | `agentline doctor`                               |
| Switch theme                    | edit `theme` in config (see step 2)              |
| Add or remove a widget          | edit `lines[].widgets[]` in config (see step 3)  |
| Reset config to a fresh preset  | `agentline config init --force --preset default` |
| Open the interactive TUI editor | `agentline config`                               |
| Remove agentline                | `agentline uninstall`                            |

Top-level CLI surface is intentionally small: `install` · `uninstall` · `doctor` · `config`. Everything configuration-adjacent lives under `agentline config <sub>` — see `agentline config --help`.

For deeper tasks, route through the focused sub-skills:

| Task                     | Sub-skill                 |
| ------------------------ | ------------------------- |
| Configure widgets/layout | `/agentline-configure`    |
| Browse or author themes  | `/agentline-themes`       |
| Debug statusline issues  | `/agentline-troubleshoot` |
