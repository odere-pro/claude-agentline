# agentline

[![for Claude Code](https://img.shields.io/badge/for-Claude%20Code-cc785c?logo=anthropic&logoColor=white)](https://docs.anthropic.com/claude/docs/claude-code)
[![type: CLI](https://img.shields.io/badge/type-CLI-5b8def?logo=gnubash&logoColor=white)](#get-started)
[![node ≥20](https://img.shields.io/badge/node-%E2%89%A520-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![status: pre-release](https://img.shields.io/badge/status-pre--release-blue)](./CHANGELOG.md)
[![license: MIT](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)
[![gates](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml)
[![install-matrix](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml)

A standalone, fast, themeable Claude Code statusline. Reads the Claude Code stdin payload, renders an ANSI-styled line, exits. No network at render time, no native modules, no plugin scaffolding.

---

## Features

- **39 widgets** across seven families — `session`, `git`, `tokens`, `context`, `rate-limits`, `time`, and `custom` (opt-in `git-pr` lookup)
- **Opt-in Nerd Font glyph layer** — set `"glyphs": "nerd-font"` to prepend a per-widget icon; default `"off"` keeps output byte-stable
- **4 shipped themes** with full truecolor / 256-colour / 16-colour degradation
- **Configured globally** — one config file at `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`, layered under built-in defaults and `AGENTLINE_*` env overrides; there is no per-project layer
- **Single binary, no network at render time** — the pricing table, themes, and widget registry are all embedded
- **`agentline doctor`** with auto-fix for the four most common wiring problems
- **In-session config via skills** — `install` seeds five skill files into the Claude Code agents directory so any Claude Code session can switch theme, add or remove widgets, or diagnose without leaving the prompt
- **`agentline install` / `agentline uninstall`** — wires and unwires the Claude Code `statusLine` setting; uninstall restores any prior value from backup

---

## Get started

The CLI surface is small on purpose: `install` · `uninstall` · `doctor` · `config`. Everything else lives under `agentline config <sub>`.

### 1 — install

**From source (today):**

```bash
git clone https://github.com/odere-pro/claude-agentline
cd claude-agentline
npm install && npm run build
node dist/cli.mjs install --from-source
```

**From npm (when published):**

```bash
npm install -g @agentline/cli
agentline install
```

Either path wires the Claude Code settings file (backing up any prior `statusLine`) and copies five `agentline*.md` skill files into the Claude Code agents directory. Honours `$CLAUDE_CONFIG_DIR`.

### 2 — see the default

Restart Claude Code. The statusline appears at the bottom of the prompt.

### 3 — configure inside Claude Code

In a fresh session, ask the agent:

> "switch the theme to vscode-dark"
> "add a context-percentage widget"
> "remove the session-usage widget"

The installed skills (`agentline.md`, `agentline-onboarding.md`, `agentline-configure.md`, `agentline-themes.md`, `agentline-troubleshoot.md`) give the agent the schema, paths, and guardrails it needs to edit `~/.config/agentline/config.json` for you — or it can run the `agentline config widget …` subcommands for precise, validated edits. The change shows up on the next prompt render; no restart needed.

### 4 — remove

```bash
agentline uninstall          # restores prior statusLine, removes installed skills
agentline uninstall --purge  # also removes user config + custom themes
```

Full walkthrough (doctor, presets, TUI editor, JSON Schema) → [docs/get-started.md](./docs/get-started.md)

---

## Docs

| Topic            | File                                                 |
| ---------------- | ---------------------------------------------------- |
| Get started      | [docs/get-started.md](./docs/get-started.md)         |
| CLI reference    | [docs/cli.md](./docs/cli.md)                         |
| Install          | [docs/install.md](./docs/install.md)                 |
| Configure        | [docs/config.md](./docs/config.md)                   |
| Widgets (all 39) | [docs/widgets.md](./docs/widgets.md)                 |
| Themes           | [docs/themes.md](./docs/themes.md)                   |
| TUI editor keys  | [docs/keymap.md](./docs/keymap.md)                   |
| Doctor checks    | [docs/doctor.md](./docs/doctor.md)                   |
| Troubleshooting  | [docs/troubleshooting.md](./docs/troubleshooting.md) |

---

## Requirements

- Node.js 20 LTS or newer
- macOS, Linux, or Windows under Git Bash / WSL
- Claude Code run at least once (settings file must exist)

---

## License

[MIT](./LICENSE).
