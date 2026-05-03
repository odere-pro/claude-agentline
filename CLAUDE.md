# CLAUDE.md — `agentline`

This file is the agent's entry-point briefing for the `agentline` repository. It is loaded into every Claude Code session opened from this repo.

## What agentline is

`agentline` is a **standalone CLI statusline tool**, distributed as the npm package `@agentline/cli`. The compiled bin reads JSON from stdin (Claude Code's statusline contract) and writes ANSI-styled output to stdout.

It is **not** a Claude Code plugin. There is no `.claude-plugin/plugin.json`, no slash command, no hook, no agent/skill/rule shipped from this repo. Wiring into Claude Code is consumer-side: `scripts/install.sh` writes the bin invocation into the `statusLine` key of `~/.claude/settings.json`.

## Where the spec lives

The normative spec is **`docs/plan/SPEC-v0.1.0.md`**. Treat it as authoritative. The PR roadmap is `docs/plan/PR-PLAN.md`; PR / branch / commit conventions are `docs/plan/PR-CONVENTIONS.md`.

## House rules

- **Clean-room.** The two drafts under `tmp/` are inspirational requirements only. Do not derive code, comments, or identifiers from any third-party implementation.
- **TypeScript on Node ≥20 LTS.** No native modules. Pure-JS dependencies only. Runtime deps pinned by exact version.
- **No network at render time.** The render hot path never makes outbound requests.
- **Render path stays light.** Ink and the TUI editor are imported only when `agentline config` is invoked.
- **Atomic config writes.** Persisted config writes go through write-temp + `fsync` + `rename`.
- **Reset axes are explicit.** Token, cost, and rate-limit widgets must declare their `reset` axis (`session` / `block` / `day` / `week` / `model` / `effort`); mixed-axis aggregation is forbidden.
- **No absolute paths in artefacts.** Gate 02 enforces — no `/Users/`, `/home/`, or `~/.claude/` literals in shipped files.

## Naming policy

| Artefact  | Pattern                        | Example                           |
| --------- | ------------------------------ | --------------------------------- |
| TS source | feature-folder under `src/`    | `src/widgets/git/branch.ts`       |
| Themes    | `<kebab-case>.json`            | `vscode-dark.json`                |
| Branch    | `<type>/agentline-<NN>-<slug>` | `feat/agentline-06-config-loader` |

## Non-goals (v0.1.0)

Plugin distribution (`.claude-plugin/`, slash commands, hooks, agents, skills, rules), native binaries, Homebrew, curl-installer, Bun/Deno-tested runtimes, Powershell-native scripts, telemetry, remote update checks, dynamic-library / WASM widget plugins, marketplace listing automation. See `docs/plan/SPEC-v0.1.0.md` §13.

## Quick commands

| Command                             | Purpose                     |
| ----------------------------------- | --------------------------- |
| `npm i && npm run build`            | Bootstrap and build         |
| `npm test`                          | Unit tests                  |
| `bash tests/gates/run-all.sh`       | Run all repo gates          |
| `bash scripts/install.sh --dry-run` | Preview the install actions |
| `bash scripts/doctor.sh`            | Diagnose host configuration |

## When in doubt

Read the spec section linked from the PR's `## Why`. If the spec is silent, open an issue rather than inventing behaviour.
