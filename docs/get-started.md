# Get started

`agentline` is a Claude Code statusline. The minimal flow is four steps: install, see the default, configure inside Claude Code, remove.

The top-level CLI is intentionally small: `reset` · `uninstall` · `doctor` · `edit` · `config`. Everything else lives under `agentline config <sub>` — see `agentline config --help`.

---

## Step 1 — Install

### From source (today)

```bash
git clone https://github.com/odere-pro/claude-agentline
cd claude-agentline
npm install && npm run build
node dist/cli.mjs reset --from-source
```

`--from-source` runs `npm link` so `agentline` is on your `PATH` from the checkout.

### From npm (when published)

```bash
npm install -g @odere-pro/agentline
agentline reset
```

**`reset` is the canonical setup verb.** It performs first-time wiring on a fresh host and
is safe to re-run — it reseeds the user config from the default template and rewires Claude
Code every time. To adopt a newer version **without** reseeding your config, use
`agentline start` (it rewires to the installed binary and prints a preview, preserving
`config.json`). The lower-level `agentline install` verb is the same config-preserving
wiring without the preview, and is hidden from `agentline help`; `reset` is the entry point
for users and agents.

Either way, `reset`:

1. Wires `statusLine` into `~/.claude/settings.json` (always global; backs up any prior value).
2. Seeds the user config at `~/.config/agentline/config.json` from the default config template.
3. Copies shipped themes into `~/.config/agentline/themes/`.
4. Installs five skill files into `~/.claude/agents/` (`agentline.md`, `agentline-onboarding.md`, `agentline-configure.md`, `agentline-themes.md`, `agentline-troubleshoot.md`).

See [install.md](./install.md) for `--force`, `--dry-run`, and `CLAUDE_CONFIG_DIR`.

---

## Step 2 — See the default

Restart your Claude Code session. The statusline appears at the bottom of the prompt with the default three-line layout (line 1: model, thinking-effort, git-branch, git-changes; line 2: context-percentage, token-speed, tokens; line 3: session-weekly-usage, reset-timer).

If it doesn't render:

```bash
agentline doctor          # full health report (D01–D08)
agentline doctor --fix    # auto-repair D01–D04
```

See [doctor.md](./doctor.md) for the full check list.

---

## Step 3 — Configure inside Claude Code

The five installed skills give any Claude Code session enough context to drive agentline configuration without leaving the session. Just ask:

- _"switch the theme to vscode-dark"_
- _"add a context-percentage widget"_
- _"remove the git-changes widget"_
- _"restore the default layout"_

The agent edits `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json` directly. agentline is configured globally only; there is no per-project config. The change shows up on the **next prompt render** — Claude Code re-runs the statusline bin every prompt — so no restart is needed.

If you prefer terminal-driven editing:

```bash
agentline edit            # interactive TUI editor (Ink, live preview)
```

Full reference → [cli.md](./cli.md) and [config.md](./config.md)

---

## Step 4 — Remove

```bash
agentline uninstall          # restores prior statusLine, removes installed skills
agentline uninstall --purge  # also removes user config + custom themes
```

The prior `statusLine` was backed up at install time and is restored from `~/.config/agentline/state/settings-backup.json`. The five skill files are removed from `~/.claude/agents/` only if they match the shipped versions (or unconditionally with `--purge`).

---

## Going further

| What to do next                       | Where to look                              |
| ------------------------------------- | ------------------------------------------ |
| Change widgets or layout              | [config.md](./config.md)                   |
| Pick or author a theme                | [themes.md](./themes.md)                   |
| Browse all 22 available widgets       | [widgets.md](./widgets.md)                 |
| Use the interactive TUI config editor | [keymap.md](./keymap.md)                   |
| Understand health checks in detail    | [doctor.md](./doctor.md)                   |
| Something is broken                   | [troubleshooting.md](./troubleshooting.md) |
