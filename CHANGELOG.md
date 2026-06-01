# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Pending entries live as fragments under [`changelog/`](./changelog/README.md).
> Run `bash scripts/changelog-aggregate.sh` for a dry-run preview, or
> `--apply` to inline them into `[Unreleased]` (typically done in the release PR).

## [Unreleased]

## [0.3.0] — 2026-06-01

### Added

- `5495772` — Surface host Claude CLI health: add the `claude-update` and `claude-doctor` session widgets plus doctor check D10, fed by an off-render-path `claude-health` cache that probes `claude --version` / `claude doctor` and npm, refreshed lazily by the live render via a detached `__refresh-claude-health` verb.

## [0.2.1] — 2026-06-01

### Security

- `d23f79c` — Bump the CI-only Jazzer.js fuzzing driver's transitive `tmp` dependency to 0.2.7 (>= 0.2.6), clearing GHSA-ph9p-34f9-6g65 (path traversal via unsanitised prefix/postfix); the published package never bundled `tmp` and is unaffected.

## [0.2.0] — 2026-06-01

### Added

- `a78ea09` — Add an indexable landing page: a standalone `site/index.html` (semantic HTML with Open Graph/Twitter meta and SoftwareApplication structured data) published to GitHub Pages by a new `pages` workflow, and point `package.json` `homepage` plus a README link at it — giving the project a crawlable marketing surface distinct from the GitHub repo chrome.
- `1dd2cb6` — Add a `project` session widget: shows the git repository name (origin remote), falling back to the working-directory folder name.

### Changed

- `f779928` — Improve discoverability: broaden `package.json` keywords (6 → 21) and rewrite the package description to name the feature surface, and add a keyword subtitle plus an FAQ section to the README so npm and search engines match the tool's name and capabilities.
- `072e2cf` — Expand the GitHub Pages landing page: document every one of the 28 widgets in a zero-JS, CSS-only filterable catalogue, add a Software 3.0 / agentic-engineering section with the five pillars and a worked example, a themes-and-accessible-rendering section, and an uninstall flow that highlights the byte-for-byte statusline restore; layer in `HowTo` and `BreadcrumbList` structured data, expanded FAQ and keywords, a skip link, visible focus rings, and WCAG-AA contrast tuning, while keeping the warm palette and fixing horizontal overflow down to narrow mobile widths.

### Fixed

- `9e26387` — Kill the last two Windows-only `gates` flakes: pin `core.autocrlf`/`core.safecrlf` to false in the git-snapshot test fixture so `git diff --numstat` reports insertions deterministically, and raise the install-integration `runScript` execFile budget (it stayed at 30s while the suite already allowed 120s) so a slow Windows uninstall is no longer SIGTERM'd — now surfacing the script's stderr on failure.

## [0.1.4] — 2026-05-27

### Added

- `3b2fea3` — Add the OpenSSF Best Practices badge (project 12995) to the README beside the existing Scorecard badge.
- `c9c0afa` — Document the OpenSSF Best Practices passing-level self-assessment under `docs/openssf-badge.md`, recording the Met/N/A answer and supporting evidence for every criterion.

### Changed

- `2dd2270` — Harden the release supply chain for OpenSSF Scorecard: cosign-sign the release tarball and `SHA256SUMS` with keyless Sigstore (`.sig`/`.pem` assets on each GitHub Release), pin the ClusterFuzzLite base image by digest, and document the solo-safe required-status-checks branch-protection config.
- `e8d28d2` — Install Windows `shellcheck` from a fixed release URL with SHA-256 verification instead of `choco install`, which OpenSSF Scorecard does not treat as pinned.
- `31fa278` — Attach a SLSA build-provenance attestation (`<tarball>.intoto.jsonl`) to each GitHub Release alongside the cosign signatures, so OpenSSF Scorecard's Signed-Releases check scores provenance.
- `7c6acc1` — Apply `main` branch protection to administrators too (`enforce_admins: true`, reviews still none) so OpenSSF Scorecard credits the admin-enforcement tier of Branch-Protection.

### Fixed

- `e73cf2d` — Stabilise the Windows gates run: route the install integration suite's temp-dir cleanup through a shared `rmrf` helper that retries the `EBUSY`/`EPERM` rmdir race a lingering subprocess handle can trigger, and stop leaking the sibling npm-cache tmpdir.

## [0.1.3] — 2026-05-22

### Fixed

- `302cec3` — Stop a recurring Windows-only CI flake: give the install/uninstall integration suite a realistic per-test and per-hook timeout so the two-script round-trip tests no longer intermittently time out on the slow Windows gates leg.
- `5b74a62` — Make the `plan` widget track the current session's plan: resolve it from the session transcript's latest plan-mode attachment and persist a `session_id` → plan map, so concurrent sessions and worktrees each show their own plan instead of whichever plan file was touched last globally.

## [0.1.2] — 2026-05-22

### Changed

- `b0ef73e` — Solo-maintainer Scorecard hygiene: stop importing Scorecard SARIF into GitHub code scanning (the `Upload SARIF to code scanning` step is removed and the job's `security-events` permission dropped) while keeping `publish_results` so the public OpenSSF Scorecard badge still updates; and rewrite `docs/SECURITY-CHECKLIST.md` so the solo-safe branch-protection config (block force-push + deletion, no required reviews) is the active path, with the review-required config demoted to a "second maintainer" note. Branch-Protection, Code-Review, Maintained, and CII findings are no longer surfaced as un-actionable Security-tab alerts.

### Fixed

- `1b94c87` — Ship the five `agentline*.md` skill files in the npm tarball (`agents/agentline*.md` added to `package.json` `files`) and seed them into the host's global agents directory, gated on that host config directory already existing; reword the install-time skip message so it is accurate instead of warning about a missing repo.

## [0.1.1] — 2026-05-21

### Added

- `601cf79` — Friendlier setup experience: colourise `agentline install` / `reset` output (green successes, yellow warnings, red errors, a bold-cyan brand prefix) and render file paths and URLs as underlined, OSC 8 clickable links — all gated on a TTY plus `NO_COLOR`, so piped or non-interactive output stays byte-for-byte unchanged; and print a short greeting at the end of the install flow that introduces agentline, links the author's GitHub/LinkedIn/Medium, and signs off with "Happy Agentic Engineering". No `postinstall` or other lifecycle script is used (pnpm does not run them by default and they widen the supply-chain surface).

### Changed

- `fdf89e1` — Cookbook reflects shipped subagent skill files end-to-end: cookbook chapters 00, 04, 06, 07, 08, 10, 11, 12, 13, 15, 16, 18 + `docs/GLOSSARY.md` now cover install-time seeding into the host's agents directory, byte-match-checked uninstall, and the dual meaning of `skills` vs `skill file`; chapter 14 catches up by documenting gates 23–26; new `SOFTWARE-3-0.md` at repo root names the agent-operability thesis in Karpathy's vocabulary and points at the code that makes it concrete.
- `64a535d` — Harden the release pipeline: bump `softprops/action-gh-release` to v3 (Node 24 runtime), pack and publish via pnpm, and require SSH-signed, ruleset-protected `v*` tags.
- `dca8d97` — README reorganisation and Highlights restyle: lead with a four-step `Get started` quickstart (`npm install` → `agentline install` → `agentline doctor` → `agentline edit`) followed by a single statusline example image, then rewrite the Highlights section into one consistent `**label** — sentence` bullet style with a per-family table, surfacing in-session agent configuration, the plan-link widget, picker search, per-family colour grouping, widget previews, the single global config, and reversible uninstall.

### Fixed

- `c2abd7f` — Fix red PR-time CI: ClusterFuzzLite now builds the Jazzer.js targets — the `coverage` sanitizer is the only value accepted by both cifuzz config validation and the JavaScript compile guard (which reject `none` and `address` respectively), and `esbuild` is now a direct devDependency so the fuzz bundle step resolves it under pnpm's isolated store. The gitleaks step also passes `GITHUB_TOKEN` so pull-request scans run instead of erroring out.
- `6f19df5` — Security runbook accuracy: correct the branch-protection example in `docs/SECURITY-CHECKLIST.md` to require the real matrixed check-run names (`gates / <os> / node <v>`, `analyze (javascript-typescript)`, `dependency review`) instead of placeholders that never report — and explicitly exclude `scorecard`, which only runs on push/schedule and would wedge every PR; add a `workflow_dispatch` trigger to `scorecard.yml` so the runbook's documented manual re-grade command actually works.
- `9ab460b` — Fix PR-time fuzzing: drive Jazzer.js directly over the `.clusterfuzzlite/fuzz` targets instead of the `google/clusterfuzzlite` build/run wrapper (its v1 image is structurally unusable for pure-JS projects — it rejects every sanitizer for JavaScript yet refuses to accept `none`), pin `esbuild` so the bundle step resolves, mark `.clusterfuzzlite/fuzz` as CommonJS so the harnesses load, and pass `GITHUB_TOKEN` to the gitleaks PR scan.

### Security

- `33cdcef` — Pin the PR-time Jazzer.js fuzzer so OpenSSF Scorecard's Pinned-Dependencies check stops flagging it: the CI-only driver now lives in a standalone `.clusterfuzzlite/jazzer/` manifest installed with `npm ci` against a committed, hash-pinned lockfile instead of `npm install @jazzer.js/core@^2`. The fuzzer is pinned to `@jazzer.js/core@4.0.0`, whose `cmake-js@8` build toolchain pulls a patched `tar@7.x` (the old `^2` line dragged in `tar@6.2.1`, which the dependency-review check rejected for six high-severity advisories), and Dependabot now tracks the lockfile so the pin stays current.

## [0.1.0] — 2026-05-21

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

- `fd4a882` — Post-redesign sweep — module decomposition, late polish features, glossary + comment audit: `app-decompose` / `state-split` / `catalog-split` and related refactors; `osc-link` widget, weekly-model-usage, update-check banner, doctor D05 font hint, Powerline glyph/cap arrays; gate-20 glossary + gate-21 comment-glossary land alongside a full comment audit and README refresh.

### Chapter 10 — 2026-05-15

- `e09cfd1` — Add a tech-agnostic `docs/cookbook/` set explaining the design intent behind the build.

### Chapter 11 — 2026-05-21

- `f118929` — Cut the first published release of `@odere-pro/agentline`; squash-anchor for the v0.1.0 tag.
