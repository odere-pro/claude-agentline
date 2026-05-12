---
description: Agentline troubleshoot sub-skill. Use when the statusline is broken, not showing, blank, garbled, or behaving unexpectedly. Covers doctor check interpretation, symptom-by-symptom runbooks, and full reset/wipe procedures.
---

# agentline — troubleshoot skill

Use this skill when the statusline is broken, not showing, or behaving unexpectedly.

---

## Step 1 — run doctor

```bash
agentline doctor          # full report
agentline doctor --fix    # auto-repair D01–D04
```

Read the output. Each line has a check ID (D01–D10) and a glyph:

| Glyph  | Meaning            |
| ------ | ------------------ |
| `[ok]` | passed             |
| `[!!]` | warning            |
| `[XX]` | failed             |
| `[fx]` | fixed (with --fix) |
| `[--]` | skipped            |

---

## Step 2 — match the failing check

| Check | Problem                               | Fix                                                 |
| ----- | ------------------------------------- | --------------------------------------------------- |
| D01   | `~/.claude/settings.json` missing     | `agentline doctor --fix`                            |
| D02   | `statusLine` not wired to agentline   | `agentline doctor --fix` or `agentline install`     |
| D03   | user config missing or invalid schema | `agentline doctor --fix` or `agentline config init` |
| D04   | theme file missing                    | `agentline doctor --fix`                            |
| D05   | Nerd Font absent (Powerline only)     | install font; doctor prints the command             |
| D06   | `git` not on PATH                     | install git                                         |
| D07   | pricing table older than 90 days      | `npm install -g @agentline/cli@latest`              |
| D08   | `CLAUDE_CONFIG_DIR` not writable      | fix directory permissions                           |
| D09   | `command` widget `cmd` not found      | check the command is on PATH                        |
| D10   | render snapshot mismatch              | file a bug; capture `agentline doctor` output       |

---

## Statusline not showing at all

```bash
agentline doctor
agentline doctor --fix
agentline install         # re-wire if --fix isn't enough
# restart Claude Code — statusLine is read at startup
```

---

## Blank or garbled output

```bash
agentline doctor                          # check colour-depth + terminal capabilities
```

If the issue is theme-related, try a simpler palette by editing the config:

```jsonc
// ~/.config/agentline/config.json
{ "theme": "vscode-dark" }
```

Or disable colour entirely with `NO_COLOR=1` in your shell env, then restart Claude Code.

---

## Config not loading

agentline reads a single user config at `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`. There is no project layer; a `.agentline.json` in the cwd is silently ignored.

```bash
agentline doctor --strict                  # D03 shows the exact problem
agentline config init --preset default     # scaffold a valid file
```

---

## Reset everything

```bash
agentline config init --force --preset default   # reset the user config
agentline uninstall --purge && agentline install # full wipe + reinstall
```

Full reference → [troubleshooting.md](../docs/troubleshooting.md) · [doctor.md](../docs/doctor.md)
