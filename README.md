# agentline

[![gates](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml)
[![install-matrix](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml)
[![node](https://img.shields.io/github/package-json/node-engines/odere-pro/claude-agentline)](https://nodejs.org/)
[![license](https://img.shields.io/github/license/odere-pro/claude-agentline)](./LICENSE)
[![status](https://img.shields.io/badge/status-pre--release-blue)](./CHANGELOG.md)

A standalone, fast, themeable Claude Code statusline. Reads the
Claude Code stdin payload, renders an ANSI-styled line, exits. No
network at render time, no native modules, no plugin scaffolding.

## Try it now

```bash
npx @agentline/cli preview
```

That renders a sample statusline straight to your terminal — no
install, no config, no host session needed. Add `--all-themes` to
compare the four shipped looks.

## Install

```bash
npm install -g @agentline/cli
agentline doctor --fix
```

That installs the binary, creates Claude Code's settings file if it
does not exist, and writes a working `statusLine` entry that points
at agentline.

For a checkout-based install (used during development):

```bash
git clone https://github.com/odere-pro/claude-agentline
cd claude-agentline
bash scripts/install.sh
```

Both flows are idempotent. Re-running them on a tree that is already
set up is a byte-for-byte no-op. Pass `--dry-run` to preview every
action without touching disk.

Full install + uninstall reference: [docs/install.md](./docs/install.md).

## Configure

```bash
agentline init --preset focus     # scaffold a project config
agentline preview --config .agentline.json   # see what it'll look like
agentline config                  # edit interactively in the TUI
```

`agentline init` accepts `--preset minimal | default | focus | power`
and `--scope user | project`. With no flags, it scaffolds a
`.agentline.json` in the current directory using the full default
preset (model, git, tokens, cost, session usage, clock). After write,
it prints the next two commands you'll want — preview the result, and
wire the bin into Claude Code via `agentline doctor --fix`.

User-scope config lives at
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`; project-scope
config is `${CLAUDE_PROJECT_DIR:-$PWD}/.agentline.json`. Project
config layers on top of user config; only the keys you set override.

Full configuration reference: [docs/config.md](./docs/config.md).

## Themes

Four presets are shipped:

- `vscode-dark`
- `vscode-light`
- `claude-code-dark` (default)
- `claude-code-light`

Pick one in your config, or drop a custom theme into
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/themes/`. See
[docs/themes.md](./docs/themes.md).

## Verify

```bash
agentline version
agentline doctor          # report
agentline doctor --fix    # report + repair the auto-fixable checks
agentline doctor --strict # warnings exit non-zero (CI mode)
```

The doctor runs ten checks (D01–D10) covering the settings file, the
`statusLine` wiring, your config, theme installation, the Nerd Font
when Powerline is enabled, the git binary, the embedded pricing
table, and more. Full check list:
[docs/doctor.md](./docs/doctor.md).

## Documentation

- [docs/install.md](./docs/install.md) — install, manual recipe,
  uninstall, troubleshooting.
- [docs/config.md](./docs/config.md) — file locations, layered merge,
  schema, env-var overrides, atomic writes.
- [docs/widgets.md](./docs/widgets.md) — built-in widget catalogue
  (53 widgets, seven families) with reset axes.
- [docs/themes.md](./docs/themes.md) — theme file shape, palette
  roles, Powerline.
- [docs/keymap.md](./docs/keymap.md) — TUI editor bindings and
  overrides.
- [docs/doctor.md](./docs/doctor.md) — D01–D10 checks, exit codes.
- [docs/testing.md](./docs/testing.md) — unit / golden / gate test
  workflow, cold-start bench, and the recipe for adding a widget.

The normative spec is [docs/plan/SPEC-v0.1.0.md](./docs/plan/SPEC-v0.1.0.md).

## Requirements

- Node.js 20 LTS or newer.
- macOS, Linux, or Windows under Git Bash / WSL.
- Claude Code's settings file present (Claude Code has been run at
  least once).

## Non-goals (v0.1.0)

agentline is **CLI-only** at v0.1.0. There is no slash command, no
hook, no agent / skill / rule scaffolding. Installation wires the
binary into Claude Code's `statusLine` setting and nothing else. See
SPEC §13 for the full out-of-scope list (native binaries, Homebrew,
curl-installer, telemetry, remote update checks, plugin distribution).

## Contributing

The PR conventions, branch naming, and changelog-fragment workflow
live at [docs/plan/PR-CONVENTIONS.md](./docs/plan/PR-CONVENTIONS.md)
and [CONTRIBUTING.md](./CONTRIBUTING.md). Every gate that has to pass
on every PR is enumerated in SPEC §11.2.

```bash
npm install
npm test
npm run build
bash tests/gates/run-all.sh
```

For the full test workflow (unit, golden, gates, cold-start bench, and
the recipe for adding a widget), see [docs/testing.md](./docs/testing.md).

## License

[MIT](./LICENSE).
