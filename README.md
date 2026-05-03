# agentline

[![gates](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/gates.yml)
[![install-matrix](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml/badge.svg?branch=main)](https://github.com/odere-pro/claude-agentline/actions/workflows/install-matrix.yml)
[![npm](https://img.shields.io/npm/v/@agentline/cli.svg)](https://www.npmjs.com/package/@agentline/cli)
[![node](https://img.shields.io/node/v/@agentline/cli.svg)](https://nodejs.org/)
[![license](https://img.shields.io/npm/l/@agentline/cli.svg)](./LICENSE)

A standalone, fast, themeable Claude Code statusline. Reads the
Claude Code stdin payload, renders an ANSI-styled line, exits. No
network at render time, no native modules, no plugin scaffolding.

## Install

```bash
npm install -g @agentline/cli
agentline doctor --fix
```

That installs the binary, creates Claude Code's settings file if it
does not exist, and writes a working `statusLine` entry that points
at agentline.

For a guided install with theme + config seeding from a checkout:

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

After install, your config lives at
`${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`. Edit it by
hand, or launch the TUI editor:

```bash
agentline config
```

The shipped default renders model, git, context, tokens, cost, session
usage, and a clock. To pin a project to a smaller line:

```bash
bash scripts/init.sh
```

That seeds `${CLAUDE_PROJECT_DIR:-$PWD}/.agentline.json` from
`templates/minimal.config.json`. Project config is layered on top of
the user config; only the keys you set override.

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
- [docs/widgets.md](./docs/widgets.md) — built-in widget catalogue with
  reset axes.
- [docs/themes.md](./docs/themes.md) — theme file shape, palette
  roles, Powerline.
- [docs/keymap.md](./docs/keymap.md) — TUI editor bindings and
  overrides.
- [docs/doctor.md](./docs/doctor.md) — D01–D10 checks, exit codes.

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

## License

[MIT](./LICENSE).
