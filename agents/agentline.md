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
agentline doctor          # full health report (D01–D10)
agentline doctor --fix    # auto-repair D01–D04
```

Glyphs: `[ok]` pass · `[!!]` warn · `[XX]` fail · `[fx]` fixed · `[--]` skipped.
Full check descriptions → [doctor.md](../docs/doctor.md)

---

## Configure

```bash
agentline edit            # interactive TUI editor
```

agentline is configured globally only. The single source of truth is
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`.

Full reference → [config.md](../docs/config.md)

---

## Reset

Delete the user config and re-run `agentline install`:

```bash
rm "${CLAUDE_CONFIG_DIR:-$HOME/.config}/agentline/config.json"
agentline install
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
| Stale pricing (D07)          | `npm install -g @agentline/cli@latest`                                                   |
| Powerline `>` instead of `❯` | D05: install a Nerd Font                                                                 |

More → [troubleshooting.md](../docs/troubleshooting.md) · Full CLI reference → [cli.md](../docs/cli.md)
