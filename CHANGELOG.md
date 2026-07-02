# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Pending entries live as fragments under [`changelog/`](./changelog/README.md).
> Run `bash scripts/changelog-aggregate.sh` for a dry-run preview, or
> `--apply` to inline them into `[Unreleased]` (typically done in the release PR).

## [Unreleased]

## [1.6.0] — 2026-07-02

### Added

- `e7fa21f` — Ultracode is now surfaced on the statusline: `thinking-effort` gains an `effort-ultracode` theme role and always renders `ultracode` in its signature violet — a single fixed value matching the host CLI's ultracode indicator, kept identical across every shipped theme. Because the host reports ultracode mode as `xhigh` (no distinct level), a new opt-in `ultracode` variant (`options.assumeUltracode: true`) surfaces a recognised `xhigh` as `ultracode`; it is off by default and auto-defers to a real `ultracode` level if the host ever emits one.

## [1.5.0] — 2026-07-01

### Added

- `3b1c959` — Recognise the host's new top-level `prompt_id` field (added in host 2.1.196) as an intentionally-unused passthrough identifier, keeping host-contract conformance green after the host upgrade; no statusline, editor, or CLI behaviour changes.
- `7bb9e13` — Host-provided worktree name: when the host sends `workspace.git_worktree` (or the top-level `worktree` block), the git snapshot uses it directly for the `git-worktree` widget and skips the `git rev-parse --git-dir --show-toplevel` subprocess, falling back to the git-derived path otherwise. No new widget.

## [1.4.0] — 2026-07-01

### Added

- `74288b8` — Recognise the `ultracode` effort level as a forward-compat tier: the `thinking-effort` widget now normalises it (case-insensitively) alongside the existing `low`…`max`, from a single ordered membership list. The host reports `xhigh` for ultracode mode and emits no `ultracode` level today, so the value stays inert until the host exposes it.
- `d935bfe` — Refresh the editor preview's fallback demo session: it now shows a current model (`Opus 4.8`) and the top effort tier the host emits today (`max`) instead of `Opus 4.7` / `high`, so `agentline edit` previews a representative session when no cache or transcript exists.
- `a213662` — Add an opt-in `emphasis` variant to the `thinking-effort` widget: it colour-ramps the tier (low→muted, medium→info, high/xhigh→accent, max→success) via the blessed `Cell.signal` state-colour, and gives `ultracode` its own signature purple so the mode reads as special rather than folding into the accent. The default (non-variant) rendering stays flat in the family accent, and the tier name always stays in the text so `--no-color` remains legible.

## [1.3.1] — 2026-06-30

### Added

- `434185d` — DX polish for the synthetic-git golden channel: make `render --help` self-contained (drop the repo-only `tests/golden/README.md` pointer, advertise every accessibility flag), route `render` usage errors to `render --help` without the doubled `agentline:` prefix, correct the `--fixture`/`--git` example paths in the golden docs, note the byte-identical network-fixture pair, and extend gate-14 to prove the `--git` replay vector renders offline.

## [1.3.0] — 2026-06-30

### Added

- `5c5d6d8` — Security: cleared five Dependabot advisories in dev/CI dependencies — bumped `vite` to 8.0.16 and `esbuild` to 0.28.1 via pnpm overrides, and `tar` to 7.5.19 and `@babel/core` to 7.29.7 in the Jazzer fuzzing lockfile. No shipped artefact or runtime dependency changed.
- `ed9acf6` — Security: cleared the `js-yaml` quadratic-complexity DoS advisory (GHSA-h67p-54hq-rp68) by pinning the transitive eslint dependency to 4.2.0 via a pnpm override. Development-only; no runtime dependency or shipped artefact changed.
- `6181fce` — Internal hygiene: renamed the `git-worktree` widget's source folder from `sha/` to `worktree/` to match the widget it exports, and dropped the unused `sessionName` and `skills` carriers from the session resolver (the host-contract gate now allowlists `skills`).
- `a894619` — Keep gate-29 honest across host upgrades: capture the Claude Code version 2.1.195 host-payload fixture and add the observed-but-undocumented `fast_mode` field to the conformance ignore allowlist.
- `039dccf` — Maintainability: the `model` widget's id→name fallback now derives names like `Opus 4.8`, `Opus 3`, and `Fable 5` directly from the model id, so adding a new model no longer needs a per-release table row. This path only runs when the host omits `display_name`, so live renders are byte-unchanged.
- `99c0dc1` — First-run guidance: a successful `agentline install` or `agentline reset` now prints a next-steps nudge — restart your Claude Code session to see the statusline, then `agentline edit` to customize or `agentline uninstall` to remove it (no nudge on `--dry-run` or a failed wire).
- `0c7336b` — Curated theme gallery: four new built-in themes ship alongside `claude-code-dark` — `claude-code-light` (warm light), `high-contrast` (bright on near-black), `ansi-minimal` (named ANSI only; 16-colour-safe, no truecolor needed), and `midnight` (cool slate) — so choosing a shipped theme is now a real choice.
- `a475210` — Deterministic git goldens: a golden scenario may now carry an optional `git.json` (a serialized `GitState`) that both the source harness and the published bin (`render --fixture --git`) inject as a static snapshot — no real `git`/`gh` — so git widgets get byte-stable goldens; adds `git-pr` scenarios covering the host-renders, network-hides, and network-opt-in-renders cases.

## [1.2.1] — 2026-06-29

### Added

- `f9a1f87` — Render host-provided PRs by default: the `git-pr` widget now tags PR provenance on the git snapshot (`prSource`) and gates only the network (`gh`) source behind `allowNetwork`, so a PR the host puts on stdin shows without the opt-in while the `gh` shell-out keeps its latency/privacy gate.

## [1.2.0] — 2026-06-26

### Added

- `0dec57b` — Add `gate-29` host-contract conformance: a deterministic check (`scripts/check-host-contract.mjs`) that productizes the manual `agentline-claude-code-watcher` diff. It proxies a captured `tests/fixtures/host-payload-2.1.193.json` through every module that reads a top-level stdin key and fails CI when the host sends a field nothing consumes, when a new `raw[...]` reader isn't wired into the harness, or when the `docs/cookbook/06-data-contracts.md` `Raw key` column drifts from the adapter — so the next host-contract drift (the class behind the vim-mode silent death) is caught automatically instead of by hand.
- `aa28b47` — Host-provided PR and repo: when the host sends a `pr` block (number + url), the git snapshot uses it directly and skips the `gh` shell-out; `pr.review_state` feeds the new `git-pr-review` widget (glyph/word variants); and `workspace.repo` feeds a new `owner/name` variant for `git-origin-repo`.

### Changed

- `1ae7914` — Release v1.1.1: fold the pending fragments into a curated `[1.1.1]` section of `CHANGELOG.md`, clear the folded fragments, and bump the package, bundled bin, and landing-page version to 1.1.1.
- `1bb68ee` — Tidy host-contract drift surfaced by the Claude Code version 2.1.193 sync: widen the `thinking-effort` widget's `Effort` union and normalise guard to recognise the new `max` level (it already printed, but future `Effort`-branching code would have missed it), and refresh `docs/cookbook/06-data-contracts.md` — add the actively-parsed `context_window` and `cost` stdin rows and list `max` for `thinkingEffort`. No per-effort colours added; the widget keeps its single session-family accent.

## [1.1.1] — 2026-06-26

### Changed

- `6338c97` — Release v1.1.0: promote the `agentline start` command into a curated `[1.1.0]` section of `CHANGELOG.md`, clear the folded fragments, and bump the package, bundled bin, and landing-page version to 1.1.0.

### Fixed

- `58f7f9c` — Fix the silently-dead `vim-mode` widget: the stdin adapter now reads Claude Code version 2.1.193's nested `vim: { mode }` block (lower-casing the uppercase value) while still dual-reading the legacy flat `vim_mode` key, so the widget renders again.

## [1.1.0] — 2026-06-20

### Added

- `a7f439e` — Add a visible `agentline start` command: re-wire the statusLine to the installed binary and print a one-shot preview rendered through your existing config, without overwriting it — the config-preserving counterpart to `reset`, for adopting a freshly upgraded version. Wires into the CLI dispatch table and help, ships `cmd.start.*` dictionary entries, and is documented across the CLI reference, README, install/get-started docs, and the landing page.

## [1.0.2] — 2026-06-20

### Security

- `cdd6570` — Bump the pinned `ws` override from `8.20.1` to the patched `8.21.0` to clear GHSA-96hv-2xvq-fx4p, a high-severity memory-exhaustion DoS reported against `ws <8.21.0` (pulled in transitively via `ink`). Restores `gate-23` (dependency audit) to green; `ink`'s `^8.15.0` range accepts the new pin.

## [1.0.1] — 2026-06-11

### Changed

- `8c466a7` — Align the GitHub Pages landing page with the README and the odere-pro wiki-pages design system: correct the install flow to the canonical `agentline reset` verb (was `agentline install`) in the install panels and the HowTo structured data, fix the "5 families" FAQ count to 6, and restyle the page onto the wiki-pages-plugin palette and UX — slate-blue base with teal/blue accents, Inter type, dual-glow background, gradient hero headline, a traffic-light terminal panel, bento feature grids, and 10px controls — while keeping the page fully self-contained with zero render-time network requests.

### Fixed

- `c02e5d9` — Fix the clock widget to render the system's local timezone instead of UTC: it now formats through `Intl.DateTimeFormat`, defaulting to the host's local zone, with a new `timezone` option accepting an IANA string (e.g. `Europe/Stockholm`) for an explicit override. Unit tests pin `timezone: "UTC"` to keep goldens byte-stable across CI runners (the D-006 determinism contract).
- `371f7b7` — Stop the git widgets flickering and dropping branch / worktree / PR on slow ticks: a transient `git` timeout now holds the last-known-good snapshot (cached per repo) instead of blanking, while a genuine change still updates; also collapses the per-tick `git rev-parse` spawns.

## [1.0.0] — 2026-06-07

First stable release. `1.0.0` freezes the public CLI surface and the config schema; subsequent breaking changes to CLI flags, config shape, or schema version follow the post-1.0 deprecation policy in `docs/cookbook/16-release-and-versioning.md`.

### Added

- `8168d50` — Ship `minimal` and `power` config templates beside `default` (all schema-validated by gate-11), add `agentline config init [--preset <name>] [--force]` to seed a config from one, and surface each widget's display variants in `config widget catalog`.
- `388951e` — Parse the Claude Code stdin cost block and add the `cost-usd` (tokens), `session-duration`, and `lines-changed` (session) widgets fed by it.
- `33395ec` — Add the `cwd-path`, `clock`, `output-style`, and `vim-mode` session widgets, each reading a field already present on the render context.
- `8b0f548` — Plumb five more Claude Code stdin fields and add the `agent-name`, `project-dir`, `added-dirs`, `context-200k-flag`, and `thinking-enabled` widgets.
- `c587446` — Add the derived `cost-burn-rate`, `api-duration`, and `cost-efficiency` tokens widgets.
- `7536d5e` — Add `agentline config undo` — single-level rollback of the last config change, captured through the shared atomic-write seam before each mutation.
- `c10cbaa` — Make `config undo` reversible and add `agentline config redo` (a 2-slot back/forward stack; a new edit after an undo invalidates the redo).
- `d65f9e0` — Add doctor check D11 (widget config sanity), flagging an unknown widget `type` or a `git-pr` widget without `allowNetwork`; harden `account-email` to hide rather than show a mismatched identity.
- `c0e4196` — Add install/uninstall shell gates 07–10 (round-trip, content preservation, idempotency, dry-run parity), each in a hermetic offline sandbox.
- `3ce9494` — Enforce strict per-widget option validation across every widget and add the `cost-vs-limit` tokens widget (session spend against a configured budget).

### Changed

- `25ea6c2` — Tighten config/schema correctness: resolvable `$schema`/`$id` URLs, a catalogue-derived `widget.type` enum (gate-28), `version` pinned to `enum: [1]`, and mutation-time option-key/value validation.
- `a7b983b` — Move host CLI health ownership into doctor check D10 so the render path no longer forks a probe on each stale render.
- `2795a97` — Rewrite `SOFTWARE-3-0.md` into a parity-checked seven-surface map and add gate-12 (render determinism over the published bin) and gate-27 (doc citation existence).
- `8e144e8` — Tidy the root README (drift reconciled, npm version badge added) and refresh the landing page.
- `a3cf9c6` — Sync the non-gate-checked docs and landing page to the then-current widget catalogue.
- `442065b` — **BREAKING:** regroup the 38-widget catalogue into six families (new `other` family; `project`/`project-dir` move to `git`), merge the two reset timers into a single `reset-timer`, and add a `context-cached` widget plus a `showCached` option on `context-percentage`. Configs naming a removed `type` render the hidden unknown-type path; no migration shim.

### Fixed

- `f3fc294` — Fix five widget-render bugs: `git-pr` opt-in wiring, reset-timer overflow on an out-of-range `resets_at`, the weekly-usage cap, token rounding at the unit boundary, and control-character stripping from rendered text.
- `ec5ab5b` — Make config failures self-healing: `doctor --fix` converges on a simultaneously-missing-settings / corrupt-config state, and an invalid config is surfaced (stderr, TTY only) instead of silently swallowed on render.
- `79e25e8` — CLI lifecycle hygiene: `edit --help` exits cleanly in a non-interactive shell, the double `agentline:` error prefix is removed, the uninstall hint points at `agentline reset`, and `update-check` / `install --force` are documented honestly.
- `cc536e3` — Make the `pages` workflow self-enable GitHub Pages so a repo without Pages turned on no longer hard-fails.
- `cba491e` — Deflake the Windows-only git-snapshot suite (filesystem-propagation delay on freshly created temp repos); test-only.

### Removed

- `3548ffd` — **BREAKING:** trim the widget catalogue from 30 to 22 — remove `claude-doctor`, `claude-update`, `context-bar`, `context-length`, `git-sha`, and `git-untracked`, and fold the two `*-reset-at` widgets into wall-clock format variants on the timer widgets. A config naming a removed `type` now renders a hidden cell, not an error.

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
