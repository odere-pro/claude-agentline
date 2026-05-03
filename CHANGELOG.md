# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ab0b894` — Repository bootstrap (`.gitignore`, `.editorconfig`, `.markdownlint.jsonc`, `LICENSE`, `CHANGELOG.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, README skeleton).
- `2e41b52` — Gates orchestrator (`tests/gates/run-all.sh`) and shared `tests/gates/lib/common.sh` helpers; first three gates land alongside (`gate-01-doctor` skips until skeleton lands, `gate-02-no-absolute-paths`, `gate-03-shellcheck -x -S style -P SCRIPTDIR`). Strict 0/1/2 exit contract; per-gate NDJSON results captured under `tests/gates/.tmp/` for CI artefact upload.
- `53c22eb` — TypeScript scaffold per §3: `package.json` (`@agentline/cli`, exact runtime deps, `bin`, `files` allowlist, `publishConfig.provenance`), `tsconfig.json`, `tsup.config.ts`, ESLint + Prettier configs, `src/cli.ts` dispatch entry with `render`/`version`/`help` wired, `src/stdin/` Claude Code contract parser (256 KB cap, truncation flag, untouched `raw`, `StdinParseError`), `npm run {build,test,lint,typecheck,format}` scripts, `vitest` suite covering the parser.
- `354d925` — Config loader (§4): layered merge (defaults → user → project → env → flags) with array-replace semantics; `schemas/config.schema.json` as canonical source of truth; Ajv strict validation surfacing every violation; `AGENTLINE_*` env layer with JSON value decoding; `${CLAUDE_CONFIG_DIR}` / `${CLAUDE_PROJECT_DIR}` path resolution; atomic write helper (write-temp + fsync + rename, §4.9); embedded schema (build-time inlined, no runtime fs read); `agentline schema [--write <dir>]` subcommand (§9.1). 33 new vitest cases; total 38 passing.
