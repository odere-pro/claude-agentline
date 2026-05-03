# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ab0b894` — Establish the project: ship the standard repo files (`.gitignore`, `.editorconfig`, `.markdownlint.jsonc`, `LICENSE`, `CHANGELOG.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, README skeleton) so contributors have a baseline to work from.
- `2e41b52` — Wire up the gates orchestrator so every PR can prove its quality bar in one command: `tests/gates/run-all.sh` discovers gate scripts under `tests/gates/`, runs them with a strict 0/1/2 exit contract, and writes per-gate NDJSON results under `tests/gates/.tmp/` for CI artefact upload. First three gates land alongside (`gate-01-doctor` skips until skeleton lands, `gate-02-no-absolute-paths`, `gate-03-shellcheck`).
- `53c22eb` — Make the package publishable and runnable end-to-end: `package.json` declares `@agentline/cli` with a single `agentline` bin, exact-version runtime deps, a strict `files` allowlist, and provenance-on publishing. `src/cli.ts` dispatches subcommands and falls through to a render path that reads stdin and prints a one-line ASCII fallback so the host UI is never blank. `src/stdin/` parses the Claude Code statusline payload safely (256 KB cap, truncation flag, untouched raw object, structured `StdinParseError` on bad input). `npm run {build,test,lint,typecheck,format}` are all wired; first vitest suite covers the parser.
- `354d925` — Give agentline a real configuration story: a layered loader merges built-in defaults, the user file, the per-project file, `AGENTLINE_*` env vars, and CLI flags (last layer wins, arrays replace wholesale). The merged tree is validated against a canonical JSON Schema so typos like `globel.padding` fail fast with every offending key listed. Persisted writes go through write-temp + fsync + rename so editor watchers always see one consistent state. The schema is embedded into the bin at build time so the render path needs zero filesystem reads. New `agentline schema [--write <dir>]` subcommand prints the schema or drops it into the user's editor config dir. Adds 33 unit tests (38 total passing).
- `d3053f0` — Unblock the install/init/doctor/uninstall gate suite ahead of the real bodies: adds skeletons for `scripts/{install,init,doctor,uninstall}.sh` plus the shared `scripts/lib/common.sh` (logging, OS detect, Node ≥20 check, EXIT cleanup trap, guarded `al_safe_rm`) that parse documented flags and exit 0. Lands `gate-04-init-idempotency` (two consecutive runs against an isolated `$CLAUDE_PROJECT_DIR` sandbox must produce byte-identical snapshots) and flips `gate-01-doctor` from skip to pass.
