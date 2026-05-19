---
description: Agentline statusline assistant. Use when the user asks about agentline — installing, configuring, theming, troubleshooting, or running doctor. Provides a cheatsheet and delegates to focused sub-skills for deeper tasks.
---

# agentline — statusline assistant

Use this skill when the user asks about:

- The statusline not showing in Claude Code
- Changing what the statusline displays (widgets, layout, theme)
- agentline install, uninstall, edit, or doctor commands
- Tokens, cost, or git info not appearing
- Resetting agentline to defaults

For deeper tasks, invoke the focused sub-skill:

| Task                       | Sub-skill                 |
| -------------------------- | ------------------------- |
| Just installed — what now? | `/agentline-onboarding`   |
| Configure widgets/layout   | `/agentline-configure`    |
| Browse or author themes    | `/agentline-themes`       |
| Debug statusline issues    | `/agentline-troubleshoot` |

---

## Diagnose

```bash
agentline doctor          # full health report (D01–D09)
agentline doctor --fix    # auto-repair D01–D04 and D09
```

D09 checks that `~/.claude/settings.json` `statusLine.refreshInterval`
matches agentline's configured `refreshInterval` (default `5` seconds);
`--fix` re-syncs it from config.

Glyphs: `[ok]` pass · `[!!]` warn · `[XX]` fail · `[fx]` fixed · `[--]` skipped.
Full check descriptions → [doctor.md](../docs/doctor.md)

---

## Configure

```bash
agentline edit                       # interactive TUI editor
agentline config refresh             # print the statusline refresh interval
agentline config refresh <seconds>   # set it (0 disables; default 5)
```

agentline is configured globally only. The single source of truth is
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.

Full reference → [config.md](../docs/config.md)

---

## Reset

Run `agentline reset` — it overwrites the user config with the default template, re-seeds themes/skills, and ensures `statusLine` is wired:

```bash
agentline reset
```

---

## Themes

agentline ships one default theme (`claude-code-dark`). Switch by setting
`"theme": "<name>"` in the config file or via `AGENTLINE_THEME=<name>`.
Author additional themes by dropping JSON into
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/themes/`.
Full reference → [themes.md](../docs/themes.md)

---

## Install / Uninstall

```bash
npm install -g @agentline/cli && agentline install   # install
agentline uninstall [--purge]                        # uninstall
```

Full reference → [install.md](../docs/install.md)

---

## Quick fixes

| Symptom                      | Action                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Statusline not showing       | `agentline doctor --fix` then restart Claude Code                                        |
| Blank/garbled output         | Reset config (see above), run `agentline doctor`                                         |
| Config ignored               | Check path is `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json` (no project layer) |
| Outdated CLI                 | `npm install -g @agentline/cli@latest`                                                   |
| Powerline `>` instead of `❯` | Install a Nerd Font, or set `AGENTLINE_GLYPHS=nerd`                                      |

More → [troubleshooting.md](../docs/troubleshooting.md) · Full CLI reference → [cli.md](../docs/cli.md)
