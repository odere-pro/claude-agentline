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

## Demo

> Demo GIF coming soon — run `agentline preview` to try it now, or `agentline preview --all-themes` to compare all four shipped themes side-by-side.

---

## Features

- **53 widgets** across seven families — model, git, tokens, cost, context, rate-limits, clock, and a fully custom shell-command widget
- **4 shipped themes** with live swatch preview in the terminal and full truecolor/256-colour/16-colour degradation
- **Two-layer config** — user global config layered under project-local `.claude/agentline.json`; only the keys you set override
- **Single binary, no network at render time** — the pricing table, themes, and widget registry are all embedded
- **`agentline doctor`** with auto-fix for the four most common wiring problems
- **`agentline install` / `agentline uninstall`** — wires and unwires the Claude Code `statusLine` setting and installs/removes agentline skill files automatically

---

## Get started

**From npm (recommended):**

```bash
npx @agentline/cli preview --all-themes  # try before installing

npm install -g @agentline/cli
agentline install   # wires statusLine into ~/.claude/settings.json
# Restart Claude Code session — statusline appears at the next prompt
```

**From source (local checkout):**

```bash
git clone https://github.com/odere-pro/claude-agentline
cd claude-agentline
npm install && npm run build
node dist/cli.mjs install --from-source
# Restart Claude Code session — statusline appears at the next prompt
```

`--from-source` runs `npm link` so `agentline` is on your PATH from the checkout. Any prior `statusLine` value is backed up before being overwritten; `agentline uninstall` restores it.

Full walkthrough (doctor, presets, config) → [docs/get-started.md](./docs/get-started.md)

---

## Docs

| Topic               | File                                                 |
| ------------------- | ---------------------------------------------------- |
| Get started         | [docs/get-started.md](./docs/get-started.md)         |
| CLI reference       | [docs/cli.md](./docs/cli.md)                         |
| Install             | [docs/install.md](./docs/install.md)                 |
| Configure           | [docs/config.md](./docs/config.md)                   |
| Widgets (all 53)    | [docs/widgets.md](./docs/widgets.md)                 |
| Themes              | [docs/themes.md](./docs/themes.md)                   |
| Keymap (TUI editor) | [docs/keymap.md](./docs/keymap.md)                   |
| Doctor checks       | [docs/doctor.md](./docs/doctor.md)                   |
| Troubleshooting     | [docs/troubleshooting.md](./docs/troubleshooting.md) |

---

## Requirements

- Node.js 20 LTS or newer
- macOS, Linux, or Windows under Git Bash / WSL
- Claude Code run at least once (settings file must exist)

---

## License

[MIT](./LICENSE).
