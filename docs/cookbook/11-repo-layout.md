# 11 · Repository layout

> **Intent:** Specify the folder layout abstractly — no file extensions tied to a specific stack — with one-line responsibility per folder.
> **Reads-with:** `04-architecture`, `07-component-specs`, `15-documentation-set`.

```text
<repo>/
├── .github/
│   ├── workflows/                    CI workflows (gates, release, skew checks)
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template
├── docs/
│   ├── plan/
│   │   ├── SPEC-vX.Y.Z               Normative stack-locked spec (this repo's instantiation)
│   │   ├── PR-PLAN                   Roadmap mapping spec sections to PRs
│   │   └── PR-CONVENTIONS            Branch / commit / PR rules
│   ├── README                        Index, link grid
│   ├── architecture                  Render path / cold path overview
│   ├── cli                           Verb reference
│   ├── config                        On-disk config shape
│   ├── widgets                       Catalogue of every widget
│   ├── themes                        Theme schema and presets
│   ├── keymap                        Editor bindings
│   ├── doctor                        Check IDs with cause/fix
│   ├── install                       Install / uninstall details
│   ├── testing                       How to run tests + gates
│   ├── troubleshooting               Symptom → cause → fix
│   └── GLOSSARY                      Canonical vocabulary
├── examples/                         Maintainer dogfood configs (S1)
├── schemas/
│   ├── config.schema                 Source of truth for user config
│   └── theme.schema                  Source of truth for theme files
├── scripts/
│   ├── install                       Wrapper around <bin> install
│   ├── doctor                        Wrapper around <bin> doctor
│   ├── uninstall                     Wrapper around <bin> uninstall
│   └── lib/                          Shared shell helpers (logging, OS detect, version check)
├── templates/
│   ├── default.config                Shipped default; installed if no user config
│   └── minimal.config                Smaller shipped variant
├── themes/
│   └── …                             Built-in theme files
├── changelog/                        Per-PR fragments; aggregator promotes to CHANGELOG at release
├── tests/
│   ├── gates/
│   │   ├── lib/                      Shared gate helpers
│   │   ├── gate-01-doctor            …
│   │   ├── …
│   │   └── run-all                   Orchestrator
│   ├── golden/
│   │   └── <scenario>/
│   │       ├── stdin.json
│   │       ├── config.json
│   │       ├── clock.txt
│   │       └── expected.ansi
│   ├── integration/                  Install/uninstall lifecycle on real disk
│   ├── widgets/                      Per-widget unit tests
│   └── tui/                          Editor unit tests
├── src/
│   ├── <entry>                       The CLI dispatch entry point (src/cli.ts) + src/version.ts
│   ├── core/
│   │   ├── stdin/                    Stdin reader and parser
│   │   ├── schema/                   Schema embedding + custom keywords
│   │   ├── i18n/                     Message catalogue
│   │   └── lib/                      Pure utilities (env, fs, atomic-write, object helpers, result types)
│   ├── data/
│   │   ├── config/                   Layered loader, env decoder, validator wiring
│   │   ├── theme/                    Named-theme resolver, palette
│   │   ├── tokens/                   Transcript reader, axis bucketing, token speed
│   │   ├── session/                  Session field resolver + auth-file fallback
│   │   ├── git/                      Git command invocation + output parser
│   │   └── state/                    Stdin cache, render cache, config backup
│   ├── widgets/                      One folder per family; registry; cell + types
│   ├── render/
│   │   ├── render/                   Composer, width, ANSI encoder, fixture runner
│   │   └── powerline/                Powerline transform
│   ├── tui/
│   │   ├── tui/                      Editor app (cold path; lazy-imported only)
│   │   └── keys/                     Keymap registry
│   └── commands/
│       ├── cli/                      CLI help-string utilities
│       ├── doctor/                   Checks + fixes
│       ├── install/                  install verb
│       ├── uninstall/                uninstall verb
│       ├── reset/                    reset verb
│       └── update-check/             Out-of-render version-check verb
├── dist/                             Built artefacts (gitignored)
├── CHANGELOG                         Promoted at release time from changelog/
├── CLAUDE                            Optional: agent-entry-point briefing for repos using the host
├── CONTRIBUTING
├── CODE_OF_CONDUCT
├── LICENSE
├── README                            Top-level value proposition + install + link grid
├── SECURITY                          Disclosure channel + SLA
├── SUPPORT
└── <package descriptor>              package.json / pyproject.toml / Cargo.toml / equivalent
```

## Per-folder responsibility (one line each)

| Folder                       | Owns                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `.github/`                   | CI configuration and contribution templates.                                          |
| `docs/`                      | User-facing documentation.                                                            |
| `docs/plan/`                 | Engineering documents the user does not read.                                         |
| `examples/`                  | Configs maintainers use; updated when defaults change.                                |
| `schemas/`                   | The single source of truth for on-disk JSON shapes.                                   |
| `scripts/`                   | Shell entry points wrapping the bin's verbs.                                          |
| `templates/`                 | Shipped default configs.                                                              |
| `themes/`                    | Shipped themes.                                                                       |
| `changelog/`                 | Per-PR fragment files; one bullet per PR.                                             |
| `tests/gates/`               | Whole-product invariant gates; shell-orchestrated.                                    |
| `tests/golden/`              | Fixture scenarios for byte-exact render comparison.                                   |
| `tests/integration/`         | Real-disk install/uninstall lifecycle tests.                                          |
| `src/<entry>`                | CLI dispatch (`src/cli.ts`) + `src/version.ts`; verbs delegate to their module.       |
| `src/core/stdin/`            | Stdin read + parse + truncation handling.                                             |
| `src/core/schema/`           | Schema embedding; custom keyword for reset-axis.                                      |
| `src/core/i18n/`             | Message catalogue.                                                                    |
| `src/core/lib/`              | Pure utilities; no business logic.                                                    |
| `src/data/config/`           | Layered merge, env decoder, schema validation, atomic writes, mutate-by-path helpers. |
| `src/data/theme/`            | Named theme → palette by role.                                                        |
| `src/data/tokens/`           | Transcript caching, axis bucketing, token speed.                                      |
| `src/data/session/`          | Session field extraction; auth-file fallback.                                         |
| `src/data/git/`              | `git -C` invocation; parser; CRLF / Windows path normalisation.                       |
| `src/data/state/`            | On-disk caches and backup metadata.                                                   |
| `src/widgets/`               | One file per widget family; registry; cell helpers; widget types.                     |
| `src/render/render/`         | Composer; width; truncation; ANSI encoder; fixture runner.                            |
| `src/render/powerline/`      | Chevron transform; glyph fallback; adjoining colour math.                             |
| `src/tui/tui/`               | Editor app; lazy-imported only on `edit` verb.                                        |
| `src/tui/keys/`              | Keymap registry; gate scans this for coverage.                                        |
| `src/commands/cli/`          | CLI help-string utilities.                                                            |
| `src/commands/doctor/`       | D01–D08 checks; documented repairs.                                                   |
| `src/commands/install/`      | Wires `statusLine`; seeds config; copies themes; writes backup.                       |
| `src/commands/uninstall/`    | Restores backup; removes seeded files; verifies checksum.                             |
| `src/commands/reset/`        | Reset verb for token/cost/rate-limit counters.                                        |
| `src/commands/update-check/` | Out-of-render version check.                                                          |

## What MUST NOT exist

- `.<host>-plugin/` (any plugin scaffold of the host application). The product is a CLI, not a plugin.
- `agents/`, `commands/`, `hooks/`, `powers/`, `rules/`, `skills/` directories that constitute host-plugin artefacts.
- Hardcoded user-home paths in shipped artefacts (`/Users/*`, `/home/*`, `~/.claude/*` literals) — gate 02 enforces.

## When deviating

Any deviation from this tree at PR-merge time MUST be justified in a single line under the README's "Layout" section. The cookbook treats deviations as low-friction; the documentation expectation is high — future readers must understand why the tree drifted from the canonical layout.
