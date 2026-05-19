# CLAUDE.md — `agentline`

This file is the agent's entry-point briefing for the `agentline` repository. It is loaded into every Claude Code session opened from this repo.

## What agentline is

`agentline` is a **standalone CLI statusline tool**, distributed as the npm package `@agentline/cli`. The compiled bin reads JSON from stdin (Claude Code's statusline contract) and writes ANSI-styled output to stdout.

It is **not** a Claude Code plugin. There is no `.claude-plugin/plugin.json`. Wiring into Claude Code is consumer-side: `agentline install` writes the bin invocation into the `statusLine` key of `~/.claude/settings.json` and copies Claude skill files from `agents/` (repo root) into `~/.claude/agents/` so Claude Code can assist with configuration and troubleshooting. `agentline uninstall` reverses both steps.

## Where the rules live

PR / branch / commit conventions are in **`docs/PR-CONVENTIONS.md`**. End-user and architecture docs live under `docs/`; the `docs/cookbook/` set explains the design intent behind the build.

## House rules

- **Clean-room.** The two drafts under `tmp/` are inspirational requirements only. Do not derive code, comments, or identifiers from any third-party implementation.
- **TypeScript on Node ≥20 LTS.** No native modules. Pure-JS dependencies only. Runtime deps pinned by exact version.
- **No network at render time.** The render hot path never makes outbound requests.
- **Render path stays light.** Ink and the TUI editor are imported only when `agentline edit` is invoked.
- **Atomic config writes.** Persisted config writes go through write-temp + `fsync` + `rename`.
- **Reset axes are explicit.** Token, cost, and rate-limit widgets must declare their `reset` axis (`session` / `block` / `day` / `week` / `model` / `effort`); mixed-axis aggregation is forbidden.
- **No absolute paths in artefacts.** Gate 02 enforces — no `/Users/`, `/home/`, or `~/.claude/` literals in shipped files.
- **Configured globally only.** There is no per-project config layer. The single source of truth is `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`; a `.agentline.json` in the cwd is silently ignored.

## Naming policy

| Artefact  | Pattern                        | Example                           |
| --------- | ------------------------------ | --------------------------------- |
| TS source | feature-folder under `src/`    | `src/widgets/git/branch.ts`       |
| Themes    | `<kebab-case>.json`            | `claude-code-dark.json`           |
| Branch    | `<type>/agentline-<NN>-<slug>` | `feat/agentline-06-config-loader` |

## Non-goals (v0.1.0)

Plugin distribution (`.claude-plugin/`), native binaries, Homebrew, curl-installer, Bun/Deno-tested runtimes, Powershell-native scripts, telemetry, remote update checks, dynamic-library / WASM widget plugins, marketplace listing automation.

## Quick commands

| Command                                             | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `corepack enable && pnpm install && pnpm run build` | Bootstrap and build (pnpm is pinned via `packageManager`) |
| `pnpm test`                                         | Unit tests                                                |
| `bash tests/gates/run-all.sh`                       | Run all repo gates                                        |
| `node dist/cli.mjs install --from-source`           | Wire statusline + install skills locally                  |
| `node dist/cli.mjs edit`                            | Open the TUI editor                                       |
| `pnpm run preview:watch`                            | Live-reload preview while editing config                  |
| `bash scripts/install.sh --dry-run`                 | Preview the install actions (legacy)                      |
| `bash scripts/doctor.sh`                            | Diagnose host configuration (legacy)                      |

## Source layout

Core modules live under `src/`, organised into six nested groups. The CLI
dispatch entry (`src/cli.ts`) and `src/version.ts` stay at the `src/` root;
`src/widgets/` keeps its own top-level group.

| Group           | Purpose                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/core/`     | Stdin parse, schema, i18n, shared pure libs (`lib`, `stdin`, `schema`, `i18n`)                              |
| `src/data/`     | Config, theme, tokens, git, session, on-disk state (`config`, `theme`, `tokens`, `git`, `session`, `state`) |
| `src/widgets/`  | Widget families (unchanged by the regroup)                                                                  |
| `src/render/`   | Line composer + powerline transform (`render`, `powerline`)                                                 |
| `src/tui/`      | Lazy-imported TUI editor + keymap registry (`tui`, `keys`)                                                  |
| `src/commands/` | Verb implementations (`doctor`, `install`, `uninstall`, `reset`, `update-check`, `cli`)                     |

Representative leaf paths: `src/core/lib/`, `src/core/stdin/`,
`src/data/config/`, `src/data/theme/`, `src/data/state/`,
`src/render/render/`, `src/render/powerline/`, `src/tui/tui/`,
`src/tui/keys/`, `src/commands/doctor/`, `src/commands/install/`,
`src/commands/uninstall/`, `src/commands/cli/`.

## When in doubt

Check `docs/` and `docs/cookbook/` for design intent. If the docs are silent, open an issue rather than inventing behaviour.
