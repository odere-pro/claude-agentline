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

| Check | Problem                               | Fix                                             |
| ----- | ------------------------------------- | ----------------------------------------------- |
| D01   | `~/.claude/settings.json` missing     | `agentline doctor --fix`                        |
| D02   | `statusLine` not wired to agentline   | `agentline doctor --fix` or `agentline install` |
| D03   | user config missing or invalid schema | `agentline doctor --fix` or `agentline init`    |
| D04   | theme file missing                    | `agentline doctor --fix`                        |
| D05   | Nerd Font absent (Powerline only)     | install font; doctor prints the command         |
| D06   | `git` not on PATH                     | install git                                     |
| D07   | pricing table older than 90 days      | `npm install -g @agentline/cli@latest`          |
| D08   | `CLAUDE_CONFIG_DIR` not writable      | fix directory permissions                       |
| D09   | `command` widget `cmd` not found      | check the command is on PATH                    |
| D10   | render snapshot mismatch              | file a bug; try `agentline preview` to confirm  |

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
agentline preview                               # isolate from Claude Code
agentline preview --theme vscode-dark           # simpler palette
NO_COLOR=1 agentline preview                    # no colour
COLORTERM= TERM=xterm-256color agentline preview  # simulate 256-colour
```

---

## Config not loading

Project config must be at `.claude/agentline.json` (not `.agentline.json`):

```bash
agentline doctor --strict   # D03 shows the exact problem
agentline init --preset default --scope project   # scaffold a valid file
```

---

## Reset everything

```bash
agentline init --force --preset default --scope project   # reset project config
agentline init --force --preset default --scope user      # reset user config
agentline uninstall --purge && agentline install          # full wipe + reinstall
```

Full reference → [troubleshooting.md](../docs/troubleshooting.md) · [doctor.md](../docs/doctor.md)
