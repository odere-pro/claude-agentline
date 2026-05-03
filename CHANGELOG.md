# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ab0b894` — Repository bootstrap (`.gitignore`, `.editorconfig`, `.markdownlint.jsonc`, `LICENSE`, `CHANGELOG.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, README skeleton).
- `2e41b52` — Gates orchestrator (`tests/gates/run-all.sh`) and shared `tests/gates/lib/common.sh` helpers; first three gates land alongside (`gate-01-doctor` skips until skeleton lands, `gate-02-no-absolute-paths`, `gate-03-shellcheck -x -S style -P SCRIPTDIR`). Strict 0/1/2 exit contract; per-gate NDJSON results captured under `tests/gates/.tmp/` for CI artefact upload.
- `53c22eb` — TypeScript scaffold per §3: `package.json` (`@agentline/cli`, exact runtime deps, `bin`, `files` allowlist, `publishConfig.provenance`), `tsconfig.json`, `tsup.config.ts`, ESLint + Prettier configs, `src/cli.ts` dispatch entry with `render`/`version`/`help` wired, `src/stdin/` Claude Code contract parser (256 KB cap, truncation flag, untouched `raw`, `StdinParseError`), `npm run {build,test,lint,typecheck,format}` scripts, `vitest` suite covering the parser.
