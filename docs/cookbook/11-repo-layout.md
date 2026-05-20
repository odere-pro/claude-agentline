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
│   ├── cli/                          CLI dispatch entry (src/cli/cli.ts) — tsup bin output
│   ├── version                       Build-stamped version (singleton, stays at src/ root)
│   ├── core/
│   │   ├── stdin/                    Stdin reader and parser
│   │   ├── schema/embedded/          Schema embedding + custom keywords
│   │   ├── i18n/                     Message catalogue (loader/, en-dictionary, ids)
│   │   └── lib/<feature>/            Pure utilities, one feature folder per helper
│   ├── data/
│   │   ├── config/<feature>/         Layered loader, env decoder, validator (defaults/, env/, load/, merge/, mutate/, paths/, refresh/, validate/, widget/, widget-command/)
│   │   ├── theme/                    Named-theme resolver, palette (colours/, resolve/)
│   │   ├── tokens/                   Transcript reader, axis bucketing, token speed (aggregate/, context-window/, speed/, transcript/)
│   │   ├── session/                  Session field resolver + auth-file fallback (auth-file/, plan/)
│   │   ├── git/                      Git command invocation + output parser (invoke/, parse/, pr/, snapshot/)
│   │   └── state/                    On-disk caches (backup/, render-cache/, stdin-cache/, version-check-cache/)
│   ├── widgets/
│   │   ├── families/                 Catalog + family identity (catalog, catalog-types, family-factory, family-identity, one per-family file)
│   │   ├── <family>/<widget>/        One folder per widget within each family (e.g. git/branch/, git/pr/, tokens/speed/, …)
│   │   ├── cell/, clock/,
│   │   │   registry/, render-widget/,
│   │   │   separator/                Widget plumbing in feature folders
│   │   └── types.ts, widget.ts,
│   │       index.ts                  Widget contract singletons + barrel
│   ├── render/
│   │   ├── render/<stage>/           Composer/width/ANSI encoder/fixture runner, one feature per pipeline stage
│   │   └── powerline/                Powerline transform (detect/, transform/)
│   ├── tui/
│   │   ├── tui/                      Editor app shell (cold path; lazy-imported only)
│   │   ├── picker/                   Picker overlays (picker + picker-{group,helpers,search,variant,widget})
│   │   ├── preview/                  Live preview waterfall + parity guard
│   │   ├── state/                    Reducer-style state machine
│   │   └── keys/                     Keymap registry (bindings/, index.ts barrel)
│   └── commands/
│       ├── cli/                      CLI help-string utilities
│       ├── doctor/                   Checks + fixes (checks/, fix/, format/, run/)
│       ├── install/                  install verb
│       ├── uninstall/                uninstall verb
│       ├── reset/                    reset verb
│       └── update-check/             Out-of-render version-check verb (fetch/, refresh/)
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

| Folder                                                       | Owns                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `.github/`                                                   | CI configuration and contribution templates.                                                |
| `docs/`                                                      | User-facing documentation.                                                                  |
| `docs/plan/`                                                 | Engineering documents the user does not read.                                               |
| `examples/`                                                  | Configs maintainers use; updated when defaults change.                                      |
| `schemas/`                                                   | The single source of truth for on-disk JSON shapes.                                         |
| `scripts/`                                                   | Shell entry points wrapping the bin's verbs.                                                |
| `templates/`                                                 | Shipped default configs.                                                                    |
| `themes/`                                                    | Shipped themes.                                                                             |
| `changelog/`                                                 | Per-PR fragment files; one bullet per PR.                                                   |
| `tests/gates/`                                               | Whole-product invariant gates; shell-orchestrated.                                          |
| `tests/golden/`                                              | Fixture scenarios for byte-exact render comparison.                                         |
| `tests/integration/`                                         | Real-disk install/uninstall lifecycle tests.                                                |
| `src/cli/`                                                   | CLI dispatch (`src/cli/cli.ts`) + `src/version.ts` at root; verbs delegate to their module. |
| `src/core/stdin/`                                            | Stdin read + parse + truncation handling.                                                   |
| `src/core/schema/embedded/`                                  | Schema embedding; custom keyword for reset-axis.                                            |
| `src/core/i18n/`                                             | Message catalogue (`loader/`, `en-dictionary`, `ids`).                                      |
| `src/core/lib/<feature>/`                                    | Pure utilities; one feature folder per helper; no business logic.                           |
| `src/data/config/<feature>/`                                 | Layered merge, env decoder, schema validation, atomic writes, mutate-by-path helpers.       |
| `src/data/theme/`                                            | Named theme → palette by role (`colours/`, `resolve/`).                                     |
| `src/data/tokens/`                                           | Transcript caching, axis bucketing, token speed (one folder per stage).                     |
| `src/data/session/`                                          | Session field extraction; auth-file fallback (`auth-file/`, `plan/`).                       |
| `src/data/git/`                                              | `git -C` invocation; parser; CRLF / Windows path normalisation (one folder per stage).      |
| `src/data/state/`                                            | On-disk caches and backup metadata (one folder per cache).                                  |
| `src/widgets/families/`                                      | Catalog + family-identity (single source of truth for the shipped widget set).              |
| `src/widgets/<family>/`                                      | One folder per widget family; per-widget feature folders inside (`<widget>/`).              |
| `src/widgets/{cell,clock,registry,render-widget,separator}/` | Widget plumbing in feature folders.                                                         |
| `src/render/render/<stage>/`                                 | Composer; width; truncation; ANSI encoder; fixture runner; one feature per stage.           |
| `src/render/powerline/`                                      | Chevron transform; glyph fallback; adjoining colour math.                                   |
| `src/tui/tui/`                                               | Editor app shell; lazy-imported only on `edit` verb.                                        |
| `src/tui/picker/`                                            | Picker overlays (group / widget / search / variant).                                        |
| `src/tui/preview/`                                           | Live-preview waterfall + preview-live parity guard.                                         |
| `src/tui/state/`                                             | Reducer-style state machine (`state`, `state-core`, `state-mutations`, `state-picker`).     |
| `src/tui/keys/`                                              | Keymap registry; gate scans this for coverage.                                              |
| `src/commands/cli/`                                          | CLI help-string utilities.                                                                  |
| `src/commands/doctor/`                                       | D01–D08 checks; documented repairs.                                                         |
| `src/commands/install/`                                      | Wires `statusLine`; seeds config; copies themes; writes backup.                             |
| `src/commands/uninstall/`                                    | Restores backup; removes seeded files; verifies checksum.                                   |
| `src/commands/reset/`                                        | Reset verb for token/cost/rate-limit counters.                                              |
| `src/commands/update-check/`                                 | Out-of-render version check.                                                                |

## What MUST NOT exist

- `.<host>-plugin/` (any plugin scaffold of the host application). The product is a CLI, not a plugin.
- `agents/`, `commands/`, `hooks/`, `powers/`, `rules/`, `skills/` directories that constitute host-plugin artefacts.
- Hardcoded user-home paths in shipped artefacts (`/Users/*`, `/home/*`, `~/.claude/*` literals) — gate 02 enforces.

## When deviating

Any deviation from this tree at PR-merge time MUST be justified in a single line under the README's "Layout" section. The cookbook treats deviations as low-friction; the documentation expectation is high — future readers must understand why the tree drifted from the canonical layout.
