---
description: Agentline statusline assistant. Use when the user asks about agentline — installing, configuring, theming, troubleshooting, or running doctor. Provides a cheatsheet and delegates to focused sub-skills for deeper tasks.
---

# agentline — statusline assistant

Use this skill when the user asks about:

- The statusline not showing in Claude Code
- Changing what the statusline displays (widgets, layout, theme)
- agentline config, install, uninstall, or doctor commands
- Tokens, cost, or git info not appearing
- Resetting agentline to defaults

For deeper tasks, invoke the focused sub-skill:

| Task                          | Sub-skill                  |
| ----------------------------- | -------------------------- |
| Configure widgets/layout      | `/agentline-configure`     |
| Browse or author themes       | `/agentline-themes`        |
| Debug statusline issues       | `/agentline-troubleshoot`  |

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
agentline config                                  # interactive TUI editor
agentline init --preset default --scope project   # scaffold .claude/agentline.json
agentline preview --config .claude/agentline.json # preview without a session
agentline preview --watch                         # live-reload on config save
```

Config paths: user `~/.config/agentline/config.json` · project `.claude/agentline.json`
Presets: `minimal` · `default` · `focus` · `power`
Full reference → [config.md](../docs/config.md)

---

## Reset

```bash
agentline init --force --preset default --scope project   # reset project config
agentline init --force --preset default --scope user      # reset user config
```

---

## Themes

```bash
agentline themes                          # swatch table
agentline themes --show claude-code-dark  # inspect palette
agentline preview --all-themes            # render one bar per theme
```

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

| Symptom                      | Action                                            |
| ---------------------------- | ------------------------------------------------- |
| Statusline not showing       | `agentline doctor --fix` then restart Claude Code |
| Blank/garbled output         | `agentline preview --theme vscode-dark`           |
| Config ignored               | Check path is `.claude/agentline.json`            |
| Stale pricing (D07)          | `npm install -g @agentline/cli@latest`            |
| Powerline `>` instead of `❯` | D05: install a Nerd Font                          |

More → [troubleshooting.md](../docs/troubleshooting.md)
