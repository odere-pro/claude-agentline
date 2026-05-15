# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Pending entries live as fragments under [`changelog/`](./changelog/README.md).
> Run `bash scripts/changelog-aggregate.sh` for a dry-run preview, or
> `--apply` to inline them into `[Unreleased]` (typically done in the release PR).

## [Unreleased]

### Chapter 1 — 2026-05-03

- `8a206eb` — Bootstrap the repository and gates infrastructure: TypeScript build pipeline, repo layout, CI workflow, and the first wave of repo gates under `tests/gates/` (shellcheck, no-absolute-paths, accessibility fallbacks, platform matrix, no-network-render).

### Chapter 2 — 2026-05-03

- `30df4c0` — Land the config, theme, render, and lifecycle foundations: layered config loader with atomic writes, theme resolver, network-free synchronous render pipeline, and `install` / `uninstall` / `doctor` lifecycle commands; cold-start bench harness lands with gate-13.

### Chapter 3 — 2026-05-03

- `61e9e2b` — Ship the widget catalogue across seven families: `session`, `tokens`, `context`, `rate-limits`, `git`, `time`, and `custom` widgets with per-axis reset declarations enforced so token/cost/rate-limit aggregations cannot mix axes by accident.

### Chapter 4 — 2026-05-03

- `483dd1a` — Wire the v0.1.0 CLI surface, Powerline, golden tests, keymap: `render` / `install` / `uninstall` / `doctor` / `init` / `themes` / `keys` / `schema` subcommands; Powerline glyphs with ASCII fallback; golden-file render harness; keymap registry with gate-17 coverage.

### Chapter 5 — 2026-05-03

- `4bad5e2` — Write the consumer surface and adopt fragment-per-PR changelog: public docs (`install`, `config`, `widgets`, `cli`, `troubleshooting`), governance set (`CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `SUPPORT`), and gate-18 enforcing one fragment per PR.

### Chapter 6 — 2026-05-13

- `a520e37` — Rationalise the CLI, drop the project config layer, add programmatic widget mutation: top-level CLI compresses to `install` / `uninstall` / `doctor` / `config`; project-layer `.agentline.json` is removed; `src/config/mutate.ts` and the full `agentline config widget` CLI land on one shared save path. BREAKING — see commit body for migration notes.

### Chapter 7 — 2026-05-13

- `227b152` — Redesign the editor — live preview, picker, variants, glyphs, flat CLI: TUI editor rebuilt around a live-preview canvas, fuzzy widget picker, options sheet, alt-screen buffer, and 19-binding keymap; saves go through the same `src/config/mutate.ts` primitives the CLI uses.

### Chapter 8 — 2026-05-14

- `0939936` — Polish pass — render fixes, project gate, doctor D07, editor stability: empty-line / hidden / raw / merge render fixes; doctor D07 pricing-freshness diagnostics; editor save lifecycle, fullscreen restoration, picker colour-filter + initialism shortcut fixes.

### Chapter 9 — 2026-05-15

- _(this commit)_ — Post-redesign sweep — module decomposition, late polish features, glossary + comment audit: `app-decompose` / `state-split` / `catalog-split` and related refactors; `osc-link` widget, weekly-model-usage, update-check banner, doctor D05 font hint, Powerline glyph/cap arrays; gate-20 glossary + gate-21 comment-glossary land alongside a full comment audit and README refresh. Anchored as `(this commit)` because the CHANGELOG itself lives in Chapter 9 — the commit hash is whatever `git log -1` reports on `main` for this entry.
