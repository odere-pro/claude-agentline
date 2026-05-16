# Get started

`agentline` is a Claude Code statusline. The minimal flow is four steps: install, see the default, configure inside Claude Code, remove.

The top-level CLI is intentionally small: `install` · `uninstall` · `doctor` · `config`. Everything else lives under `agentline config <sub>` — see `agentline config --help`.

---

## Step 1 — Install

### From source (today)

```bash
git clone https://github.com/odere-pro/claude-agentline
cd claude-agentline
npm install && npm run build
node dist/cli.mjs install --from-source
```

`--from-source` runs `npm link` so `agentline` is on your `PATH` from the checkout.

### From npm (when published)

```bash
npm install -g @agentline/cli
agentline install
```

Either way, install:

1. Wires `statusLine` into `~/.claude/settings.json` (always global; backs up any prior value).
2. Seeds the user config at `~/.config/agentline/config.json` from the default config template.
3. Copies shipped themes into `~/.config/agentline/themes/`.
4. Installs five skill files into `~/.claude/agents/` (`agentline.md`, `agentline-onboarding.md`, `agentline-configure.md`, `agentline-themes.md`, `agentline-troubleshoot.md`).
5. Writes a manifest at `~/.config/agentline/state/manifest.json` so `agentline uninstall` is exact.

See [install.md](./install.md) for `--force`, `--dry-run`, and `CLAUDE_CONFIG_DIR`.

---

## Step 2 — See the default

Restart your Claude Code session. The statusline appears at the bottom of the prompt with the default layout (model, git-branch, context, tokens, session-usage, block-reset-timer, clock).

If it doesn't render:

```bash
agentline doctor          # full health report (D01–D09)
agentline doctor --fix    # auto-repair D01–D04
```

See [doctor.md](./doctor.md) for the full check list.

---

## Step 3 — Configure inside Claude Code

The five installed skills give any Claude Code session enough context to drive agentline configuration without leaving the session. Just ask:

- _"switch the theme to vscode-dark"_
- _"add a context-percentage widget"_
- _"remove the session-usage widget"_
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
| Browse all 42 available widgets       | [widgets.md](./widgets.md)                 |
| Use the interactive TUI config editor | [keymap.md](./keymap.md)                   |
| Understand health checks in detail    | [doctor.md](./doctor.md)                   |
| Something is broken                   | [troubleshooting.md](./troubleshooting.md) |
