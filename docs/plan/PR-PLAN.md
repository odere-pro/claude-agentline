# PR execution roadmap — `agentline` v0.1.0

This document maps the §-numbered execution sequence in [SPEC-v0.1.0.md](./SPEC-v0.1.0.md) to concrete pull requests.

Branch naming, commit format, and merge strategy: [PR-CONVENTIONS.md](./PR-CONVENTIONS.md).

## Legend

- **#** — PR sequence number (used in branch `<type>/agentline-<NN>-slug`).
- **§ ref** — spec section authorising the work.
- **Scope** — one-line summary.
- **Gates** — §11.2 gate IDs this PR makes pass.
- **Depends on** — PR numbers that must merge first.
- **Parallel-safe** — Y if openable concurrently with other parallel-safe PRs.

## PR table

| #   | Branch                                         | § ref              | Scope                                                                                                                                                                                 | Gates                  | Depends on | Parallel-safe |
| --- | ---------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- | ------------- |
| 0   | `chore/agentline-00-repo-bootstrap`            | 2                  | `.gitignore`, `.editorconfig`, `.markdownlint.jsonc`, `LICENSE`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `SECURITY.md`, empty `CHANGELOG`, README skeleton, `CLAUDE.md`                   | —                      | —          | N             |
| 1   | `feat/agentline-01-spec-and-plan`              | all                | `docs/plan/SPEC-v0.1.0.md`, `docs/plan/PR-PLAN.md`, `docs/plan/PR-CONVENTIONS.md`                                                                                                     | 05                     | 0          | Y             |
| 2   | `feat/agentline-02-gates-orchestrator`         | 11.2               | `tests/gates/run-all.sh`, `tests/gates/lib/`, gates 01–03 (doctor stub, no-absolute-paths, shellcheck)                                                                                | 01, 02, 03             | 1          | N             |
| 3   | `feat/agentline-03-lifecycle-scripts-skeleton` | 10                 | `scripts/{install,init,doctor,uninstall}.sh` skeletons; `scripts/lib/common.sh`                                                                                                       | 03, 04, 07, 08, 09, 10 | 2          | N             |
| 4   | `feat/agentline-04-ci-workflows`               | 11.1               | `.github/workflows/{gates,install-matrix}.yml`, issue templates, PR template                                                                                                          | —                      | 3          | Y             |
| 5   | `feat/agentline-05-ts-scaffold`                | 1.2 N1, 3, 9       | `package.json` (per §3), `tsconfig.json`, `tsup.config.ts`, `src/cli.ts`, `src/{stdin,render}/` minimal pipe-through; ESLint + Prettier configs; `npm test` & `npm run build` scripts | 13, 14, 15             | 3          | N             |
| 6   | `feat/agentline-06-config-loader`              | 4                  | `src/config/`, layered merge, JSON Schema embed; `schemas/config.schema.json`                                                                                                         | 11                     | 5          | N             |
| 7   | `feat/agentline-07-theme-engine`               | 5.4, 5.6           | `src/theme/`, four shipped themes under `themes/` (`vscode-dark`, `vscode-light`, `claude-code-dark`, `claude-code-light`)                                                            | —                      | 6          | Y             |
| 8   | `feat/agentline-08-render-pipeline`            | 8.2, 8.3           | Width detection, ANSI encoder, colour-depth detection, fallbacks (`--no-color`, `--no-unicode`, `--ascii`)                                                                            | 16                     | 6          | Y             |
| 9   | `feat/agentline-09-widget-base`                | 7.1                | Widget interface, registry, raw-value/merge/hidden flags                                                                                                                              | —                      | 8          | N             |
| 10  | `feat/agentline-10-widgets-session`            | 7.2                | `model`, `version`, `output-style`, `session-id`, `session-name`, `account-email`, `login-method`, `org`, `thinking-effort`, `vim-mode`, `skills`                                     | —                      | 9          | Y             |
| 11  | `feat/agentline-11-widgets-tokens-context`     | 7.3, 7.4, 8.4, 8.5 | Reset axes, pricing table, token & context widgets                                                                                                                                    | —                      | 9          | Y             |
| 12  | `feat/agentline-12-widgets-rate-limits`        | 7.5                | `session-usage`, `weekly-usage`, `block-timer`, reset timers, `compaction-counter`, `model-usage`, `effort-usage`                                                                     | —                      | 11         | N             |
| 13  | `feat/agentline-13-widgets-git`                | 7.6, 8.6           | All git widgets; CRLF + Windows path handling                                                                                                                                         | —                      | 9          | Y             |
| 14  | `feat/agentline-14-widgets-time-and-custom`    | 7.7, 7.8           | Clock, uptime, `separator`, `flex-separator`, sandboxed `command` widget                                                                                                              | —                      | 9          | Y             |
| 15  | `feat/agentline-15-powerline`                  | 5.1                | Powerline transform, glyph fallback, `autoAlign`, `continueColors`                                                                                                                    | —                      | 9          | Y             |
| 16  | `feat/agentline-16-tui-config-editor`          | 1.1 F10, 5.5       | Ink editor, live preview, atomic writes, default keymap; lazy-imported only on `agentline config`                                                                                     | 17                     | 9–15       | N             |
| 17  | `feat/agentline-17-doctor`                     | 9.2                | `agentline doctor`; `--fix` repairs D01–D04                                                                                                                                           | 01                     | 6, 8       | Y             |
| 18  | `feat/agentline-18-cli-surface`                | 9.1                | `init`, `keys`, `schema`, `themes`, `version`, `render --fixture`                                                                                                                     | —                      | 6, 16, 17  | N             |
| 19  | `feat/agentline-19-default-config`             | 4.8, 7.10          | `templates/default.config.json`, `templates/minimal.config.json`                                                                                                                      | 11                     | 10–15      | N             |
| 20  | `feat/agentline-20-install-wires-statusline`   | 10                 | `install.sh` writes `statusLine` into `~/.claude/settings.json`; `--force`, `--dry-run`                                                                                               | 07, 08, 09, 10         | 3, 5       | N             |
| 21  | `feat/agentline-21-golden-tests`               | 11.3               | `tests/golden/<scenario>/` fixtures + `gate-12-render-determinism.sh`                                                                                                                 | 12                     | 10–15, 19  | N             |
| 22  | `feat/agentline-22-cold-start-budget`          | 1.2 N2, 11.2 G13   | Performance bench + gate                                                                                                                                                              | 13                     | 8, 10–15   | Y             |
| 23  | `feat/agentline-23-platform-matrix`            | 1.5, 11.2 G15      | macOS, Linux, Windows × Node 20/22 install + render smoke against the published tarball                                                                                               | 15                     | 20         | N             |
| 24  | `docs/agentline-24-accessibility-gates`        | 1.2 N8, 11.2 G16   | Collapsed: G16 already shipped in PR 34 (`tests/gates/gate-16-accessibility-fallbacks.sh`); this PR is the bookkeeping that retires the slot                                          | 16 (already passing)   | 8, 34      | Y             |
| 25  | `feat/agentline-25-keymap-coverage`            | 5.5, 11.2 G17      | Generate keymap docs + coverage gate                                                                                                                                                  | 17                     | 16         | Y             |
| 26  | `feat/agentline-26-docs-install-config`        | 13                 | `docs/install.md`, `docs/config.md`, `docs/widgets.md`, `docs/themes.md`, `docs/keymap.md`, `docs/doctor.md`                                                                          | 05                     | 18, 19     | Y             |
| 27  | `feat/agentline-27-readme-and-badges`          | 13                 | Replace one-line `README.md`; add badges; install snippets                                                                                                                            | —                      | 26         | Y             |
| 28  | `chore/agentline-28-changelog-promote`         | 12.3, 14           | Promote `[Unreleased]` to `[0.1.0]`                                                                                                                                                   | —                      | 21–27      | N             |
| 29  | `feat/agentline-29-release-workflow`           | 11.1, 14           | `release.yml`: build, `npm publish --provenance`, attach `SHA256SUMS` to GitHub Release; tag protections                                                                              | —                      | 28         | N             |
| 30  | `feat/agentline-30-pricing-skew-workflow`      | 8.5, 11.1          | `pricing-skew.yml` + `node-skew.yml` scheduled refresh comparisons                                                                                                                    | —                      | 11, 29     | Y             |

**Total: 31 PRs (0–30).**

## Critical path

`0 → 1 → 2 → 3 → 5 → 6 → 8 → 9 → 12 → 16 → 18 → 20 → 23 → 28 → 29`. Roughly 15 sequential merges; the rest open in parallel.

## Parallel-batch suggestions

- After PR 3: open PRs 4 and 5 concurrently (CI workflows alongside the TS scaffold).
- After PR 6: open PRs 7 and 8 concurrently (theme engine alongside render pipeline).
- After PR 9: open PRs 10, 11, 13, 14, 15 concurrently (widget families).
- After PR 18: open PRs 25 and 26 concurrently.
- After PR 21: open PRs 22 and 24 concurrently.
- After PR 27: PRs 28, 30 sequence into the release.

## Notes

- PR 0 uses `chore/` because it is bootstrap-only with no behaviour change.
- PR 16 is large (TUI editor); permitted given Ink's tightly-scoped surface and the explicit gate (G17) covering it.
- PR 21 establishes golden tests; from this PR onward any renderer change MUST update goldens in the same PR.
- PR 23 may parallelise across host runners but cannot start until PR 20 wires `statusLine`.
- Removed from the v0.1.0 plan vs earlier drafts: a plugin manifest PR, a default-on PreToolUse secret-scanner hook PR, and a `/agentline` slash command PR. agentline is CLI-only at v0.1.0 (SPEC §0.1).
