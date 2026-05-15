# agentline

[![for Claude Code](https://img.shields.io/badge/for-Claude%20Code-cc785c?logo=anthropic&logoColor=white)](https://docs.anthropic.com/claude/docs/claude-code)
[![type: CLI](https://img.shields.io/badge/type-CLI-5b8def?logo=gnubash&logoColor=white)](#use)
[![node ≥20](https://img.shields.io/badge/node-%E2%89%A520-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![status: pre-release](https://img.shields.io/badge/status-pre--release-blue)](./CHANGELOG.md)
[![license: MIT](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)
[![gates](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml)
[![install-matrix](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml)

A fast, themeable statusline for Claude Code. Reads the stdin payload Claude Code's statusline contract sends, writes an ANSI-styled line, exits. No network. No native modules. No plugin scaffolding.

```text
 Opus 4.7   main ●3 ↑1   23k tokens   $0.70   4h 12m left
```

---

## Highlights

- **42 widgets** across 7 families — `session` · `tokens` · `context` · `rate-limits` · `git` · `time` · `custom`
- **Powerline-ready** rendering with arrayed chevrons & caps that cycle per line
- **Theme engine** — truecolor / 256-colour / 16-colour graceful degradation, optional Nerd Font glyph layer
- **Configure in-session** — five skills wired into Claude Code let you say _"add a context widget"_ and the agent edits your config
- **TUI editor** with live preview and widget picker (`agentline edit`)
- **Scriptable layout** — `agentline config widget <add|remove|move|replace|set-option|list|catalog>`
- **`agentline doctor --fix`** — auto-repairs settings wiring and installs JetBrainsMono Nerd Font
- **Reversible** — `install` backs up your prior `statusLine`; `uninstall` restores it byte-for-byte
- **Zero render-time I/O** — pricing table, themes, and widget registry are all embedded

---

## Use

The CLI is intentionally small: `install` · `uninstall` · `doctor` · `edit` · `config` · `start`.

### Install

```bash
# From source (today)
git clone https://github.com/odere-pro/claude-agentline && cd claude-agentline
npm install && npm run build
node dist/cli.mjs install --from-source

# From npm (when published)
npm install -g @agentline/cli
agentline install
```

Both paths produce identical runtime state — same `settings.json`,
`config.json`, themes, and manifest. Only the bytes inside the bin
differ (local checkout vs. published tarball). See
[install equivalence](./docs/install.md#install-paths-are-equivalent).

Install wires `statusLine` into Claude Code's settings, seeds `agentline/config.json` under `$CLAUDE_CONFIG_DIR`, copies shipped themes, and installs five `agentline*.md` skills wired into Claude Code. Backs up any prior `statusLine` so `uninstall` restores it.

Restart Claude Code — the statusline appears at the bottom of the prompt.

### Configure

Three equivalent paths — pick whichever fits the moment:

| Path                      | When                                              |
| ------------------------- | ------------------------------------------------- |
| _"swap the theme to X"_   | Ask the agent in any Claude Code session          |
| `agentline edit`          | Interactive TUI with live preview                 |
| `agentline config widget` | Scriptable: `add`, `remove`, `move`, `set-option` |

Changes apply on the next prompt render — no restart.

### Uninstall

```bash
agentline uninstall          # restore prior statusLine, remove installed skills
agentline uninstall --purge  # also wipe user config + custom themes
```

### Diagnose

```bash
agentline doctor             # report wiring problems
agentline doctor --fix       # auto-repair (incl. Nerd Font install)
```

---

## Docs

| Topic            | File                                                 |
| ---------------- | ---------------------------------------------------- |
| Get started      | [docs/get-started.md](./docs/get-started.md)         |
| CLI reference    | [docs/cli.md](./docs/cli.md)                         |
| Install          | [docs/install.md](./docs/install.md)                 |
| Configure        | [docs/config.md](./docs/config.md)                   |
| Widgets (all 42) | [docs/widgets.md](./docs/widgets.md)                 |
| Themes           | [docs/themes.md](./docs/themes.md)                   |
| TUI editor keys  | [docs/keymap.md](./docs/keymap.md)                   |
| Doctor checks    | [docs/doctor.md](./docs/doctor.md)                   |
| Troubleshooting  | [docs/troubleshooting.md](./docs/troubleshooting.md) |
| Architecture     | [docs/architecture.md](./docs/architecture.md)       |
| Glossary         | [docs/GLOSSARY.md](./docs/GLOSSARY.md)               |

The normative spec is [`docs/plan/SPEC-v0.1.0.md`](./docs/plan/SPEC-v0.1.0.md).

---

## Requirements

- Node.js 20 LTS or newer
- macOS, Linux, or Windows (Git Bash / WSL)
- Claude Code run at least once (settings file must exist)

---

## Contribute

Bug reports, widget ideas, theme submissions, and PRs are welcome.

```bash
# Bootstrap
npm ci
npm run build
bash tests/gates/run-all.sh        # full gate suite

# Iterate
npm run test:watch                 # unit tests
node dist/cli.mjs install --from-source  # link this checkout to Claude Code
node dist/cli.mjs start            # preview against the last cached stdin
node dist/cli.mjs edit             # exercise the TUI editor

# Sanity check before opening a PR
npm run lint && npm run typecheck && npm test
bash tests/gates/run-all.sh
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch/commit conventions, the 5-step "add a widget" recipe, gate descriptions, and the changelog-fragment workflow. Open issues at [github.com/odere-pro/claude-agentline/issues](https://github.com/odere-pro/claude-agentline/issues); security reports go through [SECURITY.md](./SECURITY.md).

---

## Source layout

Core modules follow [`docs/plan/SPEC-v0.1.0.md §2`](./docs/plan/SPEC-v0.1.0.md). Top-level `src/` directories beyond the spec table:

| Directory        | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `src/cli/`       | CLI help-string utilities                                            |
| `src/lib/`       | Shared pure utilities (env, fs, nerd-font detection, object, result) |
| `src/install/`   | `agentline install` command                                          |
| `src/uninstall/` | `agentline uninstall` command                                        |
| `src/start/`     | `agentline start` — preview from last cached stdin                   |
| `src/state/`     | Stdin payload cache, render output cache, config backup              |

---

## License

[MIT](./LICENSE).
