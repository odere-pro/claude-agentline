# 12 · Assembly instructions

> **Intent:** Define the build order as **work groups** rather than numbered PRs, so the order survives a change of stack. Each group lists prerequisites, what it produces, and exit criteria.
> **Reads-with:** `04-architecture`, `07-component-specs`, `14-gates-catalogue`.

Group IDs (Gn) are stable. A group ends when its exit criteria are met; the gates it must make pass are listed.

---

## G0 · Repository bootstrap

- **Prereq.** None.
- **Produces.** `.gitignore`, `LICENSE`, `CODE_OF_CONDUCT`, `SECURITY`, `SUPPORT`, an empty `CHANGELOG`, a one-line `README` skeleton, a `CLAUDE` briefing if the repo uses the host application internally, formatter config, editorconfig, markdown-lint config.
- **Exit.** Repo clones and lints cleanly; no source code yet.

## G1 · Specs and plan

- **Prereq.** G0.
- **Produces.** A stack-locked spec, a PR roadmap, and contribution conventions. In this repo these live at `docs/cookbook/10-tradeoffs-and-decisions.md` (decisions + rationale) and `docs/PR-CONVENTIONS.md` (branch / commit / PR rules). The cookbook is the abstract parent; the tradeoffs doc is its stack-locked instantiation.
- **Exit.** Spec exists, PR roadmap exists, conventions exist. Gate 05 (markdown lint + format) passes on these files.

## G2 · Gates orchestrator + first three gates

- **Prereq.** G1.
- **Produces.** `tests/gates/run-all`, `tests/gates/lib/`, and the first three gates (a doctor stub, no-absolute-paths, and shell-lint).
- **Exit.** `run-all` exits `0` on a fresh checkout. Gates 01, 02, 03 pass.

## G3 · Lifecycle scripts skeleton

- **Prereq.** G2.
- **Produces.** `scripts/install`, `scripts/doctor`, `scripts/uninstall`, `scripts/lib/common`. All skeletons that exec the bin (which doesn't exist yet — they'll noop or print "not yet built").
- **Exit.** Scripts pass shell-lint. Roundtrip gates 07–10 can run (they'll trivially pass against the noop scripts).

## G4 · CI workflows

- **Prereq.** G3.
- **Produces.** `gates.yml`, `install-matrix.yml`. Issue templates, PR template.
- **Exit.** CI runs on every PR; gates suite triggers; install matrix triggers across the OS × runtime matrix.

## G5 · Source scaffold + minimal pipe-through

- **Prereq.** G3.
- **Produces.** Package descriptor, build config, the bin's entry point, a minimal `stdin → echo back as one ASCII line → stdout` pipe-through. Lint/format/typecheck wired up.
- **Exit.** `<build>` produces a runnable bin. `<bin>` reads stdin and writes one line. Gates 13 (cold-start budget) and 14 (no network at render) pass against this trivial pipeline. Gate 15 (platform matrix smoke) passes.

## G6 · Config loader + schema validator

- **Prereq.** G5.
- **Produces.** `src/data/config/`, `src/core/schema/`, `schemas/config.schema`. Layered merge with env-decoder; reserved-key strip; schema embedding at build time.
- **Exit.** `<bin> config schema` prints the schema. Gate 11 passes.

## G7 · Theme engine + presets

- **Prereq.** G6.
- **Produces.** `src/data/theme/`, `schemas/theme.schema`, five shipped themes under `themes/`.
- **Exit.** A theme by name resolves to a palette; missing roles fall back to compiled defaults.

## G8 · Render pipeline

- **Prereq.** G6.
- **Produces.** Width detection, colour-depth detection, ANSI encoder, fallback flags (`--no-color`, `--no-unicode`, `--ascii`).
- **Exit.** A canned "always renders 'hello'" widget produces correctly-styled bytes. Gate 16 (accessibility fallbacks) passes.

## G9 · Widget base + registry

- **Prereq.** G8.
- **Produces.** Widget interface, registry, hidden/merged/rawValue flag handling, cell type, dispatcher.
- **Exit.** A test widget registers and renders.

## G10 · Session widgets

- **Prereq.** G9.
- **Produces.** `model`, `version`, `session-id`, `account-email` (with auth-file fallback), `thinking-effort`, `skills`.

## G11 · Tokens and context widgets

- **Prereq.** G9.
- **Produces.** Transcript reader, axis bucketing, `tokens`/`tokens-cached`, `token-speed`, `context-*`.

## G12 · Rate-limit widgets

- **Prereq.** G11.
- **Produces.** `session-weekly-usage`, `reset-timer` (combined session + weekly reset, with `at-*` variants).

## G13 · Git widgets

- **Prereq.** G9.
- **Produces.** Git resolver, all git widgets, CRLF and Windows path normalisation.

G10–G13 are **parallel-safe.**

## G15 · Powerline transform

- **Prereq.** G9.
- **Produces.** Chevron transform, glyph fallback, adjoining colour math, `autoAlign` and `continueColors` options.

## G16 · TUI editor (cold path)

- **Prereq.** G9 plus enough widgets to make the preview meaningful (G10–G13).
- **Produces.** Editor app, live preview, atomic writes, default keymap, two-line footer, three-step picker (family → widget → variant).
- **Exit.** Editor opens, edits commit atomically, gate `render-no-tui-import` continues to pass (the editor must remain lazy-imported only on the `edit` verb).

## G17 · Doctor + autofix

- **Prereq.** G6, G8.
- **Produces.** `src/commands/doctor/`, checks D01–D08, repairs for D01–D04.
- **Exit.** Gate 01 (doctor exits 0 on a healthy host) passes for real.

## G18 · Full CLI surface

- **Prereq.** G6, G16, G17.
- **Produces.** `init`, `keys`, `schema`, `themes`, `version`, `render --fixture`, `start`, `config widget` subcommands.
- **Exit.** Every verb in `08-feature-catalogue` works.

## G19 · Default config templates

- **Prereq.** G10–G15.
- **Produces.** `templates/default.config`, `templates/minimal.config`.
- **Exit.** Both validate against the schema. Gate 11 (schema round-trip) passes against the templates.

## G20 · Install / uninstall wires statusline

- **Prereq.** G3, G5.
- **Produces.** Real install logic in `src/commands/install/` and `src/commands/uninstall/`. Backup metadata. Shipped subagent skill files under `agents/` and the install-time copy into the host's agents directory (byte-match-checked at uninstall). `--force`, `--dry-run`, `--from-source`, `--purge`.
- **Exit.** Roundtrip gates 07, 08, 09, 10 pass; install + uninstall on a temp host config dir leaves both the `statusLine` setting **and** the shipped skill files in their pre-install state.

## G21 · Golden tests

- **Prereq.** G10–G15, G19.
- **Produces.** `tests/golden/<scenario>/` fixtures and `gate-render-determinism`.
- **Exit.** Gate 12 passes. From this group onward, any renderer change MUST update goldens in the same PR.

## G22 · Cold-start benchmark gate

- **Prereq.** G8, G10–G15.
- **Produces.** Performance bench + gate 13.

## G23 · Platform matrix

- **Prereq.** G20.
- **Produces.** macOS × Linux × Windows × LTS-runtime matrix install + render smoke against the published package candidate.
- **Exit.** Gate 15 passes.

## G24 · Keymap coverage gate

- **Prereq.** G16.
- **Produces.** Keymap docs + coverage gate that scans the compiled bin for every documented binding.
- **Exit.** Gate 17 passes.

## G25 · User-facing docs

- **Prereq.** G18, G19.
- **Produces.** `docs/install`, `docs/config`, `docs/widgets`, `docs/themes`, `docs/keymap`, `docs/doctor`, `docs/troubleshooting`, `docs/cli`, `docs/architecture`, `docs/GLOSSARY`.

## G26 · README and badges

- **Prereq.** G25.
- **Produces.** A proper top-level `README` with value proposition, install snippet, link grid, CI badges.

## G27 · Changelog promotion

- **Prereq.** G21–G26.
- **Produces.** `CHANGELOG`'s `[Unreleased]` section promoted to `[X.Y.Z] — date`.

## G28 · Release workflow

- **Prereq.** G27.
- **Produces.** `release.yml` that builds, publishes to the registry with provenance, attaches `SHA256SUMS` to the GitHub Release; tag protections; signing keys configured.

## G29 · Scheduled skew workflows

- **Prereq.** G28.
- **Produces.** `node-skew.yml` (or runtime equivalent).

---

## Critical path

`G0 → G1 → G2 → G3 → G5 → G6 → G8 → G9 → G12 → G16 → G18 → G20 → G23 → G27 → G28`

The longest sequence is roughly 15 groups; the rest open in parallel.

## Parallel-batch suggestions

- After **G3**: open **G4** and **G5** concurrently.
- After **G6**: open **G7** and **G8** concurrently.
- After **G9**: open **G10**, **G11**, **G13**, **G15** concurrently.
- After **G18**: open **G24** and **G25** concurrently.
- After **G21**: open **G22** and **G23** concurrently.

## Notes

- **G0** is the only group that touches no behaviour.
- **G16** is large — a TUI editor with picker and live preview. Build it incrementally with the keymap-coverage gate (G24) as the safety net.
- **G21** establishes goldens. From G21 onward, every renderer-affecting PR MUST include a golden update in the same PR; CI rejects unannounced updates by requiring a changelog fragment.
- **G23** may parallelise across CI runners but cannot start until **G20** has wired `statusLine`.

## What is _not_ in the assembly plan at v0.1.0

- Plugin manifest of the host application.
- Default-on PreToolUse hook that scans for secrets.
- Slash-command surface inside the host application.

These were considered and removed; rationale lives in `10-tradeoffs-and-decisions · D-001`.
