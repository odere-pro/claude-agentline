---
description: Agentline onboarding sub-skill. Use when the user has just run `agentline install` and asks "what now?", "how do I customize this?", or wants a guided first-time tour without leaving the Claude Code session.
---

# agentline — onboarding skill

Use this skill when the user just ran `agentline install` and wants a quick tour of what they can do next, all from inside their Claude Code session.

The flow is short on purpose:

1. confirm the statusline is rendering
2. understand where the config lives + how reloads work
3. open the editor and try a change
4. switch theme
5. roll back if they don't like it

For each step, delegate to a focused sub-skill rather than duplicating its content here.

---

## What `agentline install` actually did

Five small, reversible things — each tracked in the install manifest so `agentline uninstall` can undo them cleanly:

1. **Installed `@odere-pro/agentline` globally** (or `npm link`-ed it from a local checkout with `--from-source`).
2. **Seeded the user config** at `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`. An existing config is preserved; only a fresh tree gets the default template.
3. **Seeded shipped themes** into the user themes directory.
4. **Copied agentline skill files** (`agentline*.md`) into `~/.claude/agents/` so this skill (and its siblings) are available from inside Claude Code sessions.
5. **Wired the statusline** by setting `statusLine` in `~/.claude/settings.json` to point at the agentline bin, with a default `refreshInterval` of `5` seconds so time-varying widgets keep ticking while the session is idle. A prior `statusLine` value is backed up before the swap.

Nothing was changed in your project directory — agentline's state lives globally.

---

## Step 1 — confirm it's wired

After `agentline install` and a session restart, the statusline appears at the bottom of the Claude Code prompt. If it's blank or missing:

```bash
agentline doctor          # full health report
agentline doctor --fix    # auto-repair host wiring
```

Deeper diagnosis → `/agentline-troubleshoot`.

---

## Step 2 — config location + the reload model

Single source of truth:

```text
${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json
```

There is no per-project config layer; a `.agentline.json` in the current directory is silently ignored.

**Reloads are pull-based.** Claude Code re-invokes the agentline bin on every prompt and reads its stdout fresh. That means a config edit:

- does NOT take effect mid-prompt while the model is responding,
- DOES appear the next time you send Claude a message (when the bin runs again).

You'll see this reflected in the editor's save message: `saved → <path> (reloads on next prompt)`. No daemon, no signal, no restart needed.

Install also wires a **timed refresh** so the bin re-runs every few
seconds even when you're not sending prompts — that keeps session
duration, countdowns, and token totals from looking frozen while idle.
The default is `5` seconds; change it with `agentline config refresh
<seconds>`, or pass `0` to disable the timer and fall back to
event-driven updates only.

---

## Step 3 — open the editor and try a change

```bash
agentline edit
```

Opens a TUI editor with a **live preview** at the top:

- The preview is the editing surface — the cursor moves through the rendered statusline itself, with each row ending in a navigable `+ add widget` cell.
- If you've used Claude Code in this session, the preview shows real values from the last render — your branch, your token counts. If you haven't yet, every widget renders as its own type name (`tokens`, `git-branch`, …) so you can still see the layout.
- Common verbs: `a` add, `r` replace, `u` update variant, `d` delete, `S` save, `q`/`Esc` quit. The two-line footer at the bottom of the editor lists every binding for the current scope.

Save with `S`; the on-disk config updates atomically; the new render fires on Claude Code's next prompt.

Deeper editor work → `/agentline-configure`.

---

## Step 4 — switch the theme

Four themes ship today: `claude-code-dark`, `claude-code-light`, `vscode-dark`, `vscode-light`.

Set the `theme` field in the user config — either via the editor (open `agentline edit`, no in-place theme toggle but the file is straightforward) or by hand:

```jsonc
// ~/.config/agentline/config.json
{
  "theme": "vscode-dark",
}
```

The change applies on the next Claude Code prompt. Deeper theme work → `/agentline-themes`.

---

## Step 5 — roll back

```bash
agentline uninstall          # restores the prior statusLine, removes installed skills
agentline uninstall --purge  # also removes user config + custom themes
```

The prior `statusLine` was backed up at install time. Uninstall restores it from `~/.config/agentline/state/settings-backup.json`.

---

## Quick reference

| Want to                     | Do                                                             |
| --------------------------- | -------------------------------------------------------------- |
| See if it's working         | `agentline doctor`                                             |
| Repair host wiring          | `agentline doctor --fix`                                       |
| Open the interactive editor | `agentline edit`                                               |
| Change the refresh interval | `agentline config refresh <seconds>` (`0` disables; default 5) |
| Reset config to the default | `agentline reset` (overwrites config, re-seeds, rewires)       |
| Edit config by hand         | `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`        |
| Remove agentline            | `agentline uninstall` (add `--purge` to wipe config + themes)  |

Top-level CLI surface is intentionally small: `render` (default, fed stdin by Claude Code) · `edit` · `reset` · `uninstall` · `doctor`. See `agentline --help`. (`agentline install` still works but is hidden — `reset` is the entry point.)

For deeper tasks, route through the focused sub-skills:

| Task                     | Sub-skill                 |
| ------------------------ | ------------------------- |
| Configure widgets/layout | `/agentline-configure`    |
| Browse or author themes  | `/agentline-themes`       |
| Debug statusline issues  | `/agentline-troubleshoot` |
