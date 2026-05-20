# CLAUDE.md — `agentline`

This file is the agent's entry-point briefing for the `agentline` repository. It is loaded into every Claude Code session opened from this repo.

## What agentline is

`agentline` is a **standalone CLI statusline tool**, distributed as the npm package `@odere-pro/agentline`. The compiled bin reads JSON from stdin (Claude Code's statusline contract) and writes ANSI-styled output to stdout.

It is **not** a Claude Code plugin. There is no `.claude-plugin/plugin.json`. Wiring into Claude Code is consumer-side: `agentline install` writes the bin invocation into the `statusLine` key of `~/.claude/settings.json` and copies Claude skill files from `agents/` (repo root) into `~/.claude/agents/` so Claude Code can assist with configuration and troubleshooting. `agentline uninstall` reverses both steps.

## Where the rules live

PR / branch / commit conventions are in **`docs/PR-CONVENTIONS.md`**. End-user and architecture docs live under `docs/`; the `docs/cookbook/` set explains the design intent behind the build.

## Testing

Source files live in feature folders with their test as a sibling: `src/<area>/<feature>/<feature>.ts` + `src/<area>/<feature>/<feature>.test.ts`. The canonical TDD recipe (write-test → implement → register → document) is in **`docs/testing.md`**. Shared factories and sandbox helpers (`makeWidgetContext`, `makeGitSnapshot`, `withSandbox`, `frozenClock`, …) live under **`src/test-helpers/`** and are imported only by `*.test.ts` files — re-roll an inline `makeSnapshot` / `makeCtx` only when the file legitimately needs a different default.

## House rules

- **Clean-room.** The two drafts under `tmp/` are inspirational requirements only. Do not derive code, comments, or identifiers from any third-party implementation.
- **TypeScript on Node ≥20 LTS.** No native modules. Pure-JS dependencies only. Runtime deps pinned by exact version.
- **No network at render time.** The render hot path never makes outbound requests.
- **Render path stays light.** Ink and the TUI editor are imported only when `agentline edit` is invoked.
- **Atomic config writes.** Persisted config writes go through write-temp + `fsync` + `rename`.
- **Reset axes are explicit.** Token, cost, and rate-limit widgets must declare their `reset` axis (`session` / `block` / `day` / `week` / `model` / `effort`); mixed-axis aggregation is forbidden.
- **No absolute paths in artefacts.** Gate 02 enforces — no `/Users/`, `/home/`, or `~/.claude/` literals in shipped files.
- **Configured globally only.** There is no per-project config layer. The single source of truth is `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`; a `.agentline.json` in the cwd is silently ignored.

## Vocabulary & user-facing text

- **The glossary is authoritative.** `docs/GLOSSARY.md` is the source of truth for every term in the project — widget, family, variant, theme, role, reset axis, gate, fixture, picker, editor, en dictionary. When a term here conflicts with anything else, update the other artefact, not the glossary.
- **Three gates enforce it.** `gate-20` keeps retired terms out of docs and asserts README↔catalog parity; `gate-21` keeps retired terms out of source comments; `gate-22` validates the glossary's own counts and type-table file paths against the code. Run `bash tests/gates/run-all.sh` before any PR that touches widgets, gates, themes, or vocabulary.
- **The English dictionary is the source of truth for static UI text.** `src/core/i18n/en-dictionary.ts` (`EN_DICTIONARY`) holds every authored English string for the editor chrome, picker chrome, family display names, footer keybinding verbs, and CLI command output (`cmd.*`). Catalogue-driven widget strings (`widget.<type>.name` / `.desc` / `.variant.<id>`) author their English in `src/widgets/catalog/<family>.ts` — the catalogue is itself a dictionary keyed by widget type.
- **Use `createDictTranslator(config)` + `t(id, vars?)`** in render-reachable code that needs a translatable string. Ids live in the namespaces declared by `I18N_NAMESPACES` in `src/core/i18n/ids.ts`: `widget.*`, `family.*`, `footer.*`, `picker.*`, `app.*`, `cmd.*`. The lower-level `createTranslator` + `t(id, en, vars?)` is reserved for catalogue-driven lookups and the rare template-literal id; use builders (`widgetNameId`, `widgetDescId`, `widgetVariantId`, `widgetLabelId`, `cmdId`) where possible.
- **`gate-26` enforces the dictionary contract.** Every literal id used by any translator call must start with a registered prefix; every dictionary-form call (one quoted arg) must use an id that's a key in `EN_DICTIONARY`; every literal-en form must either omit the id from the dictionary or match `EN_DICTIONARY[id]` exactly; no id may appear with two different English fallbacks. To add or change a UI string, edit the dictionary value — the call sites pick up the change automatically.
- **Don't hand-edit counts in the glossary.** Per-family counts, the total widget count, and type-table file paths are derived from the code by gate-22. If a count is wrong, fix the code or the glossary entry; the gate will tell you which.

## Import direction (load-bearing)

```
                  ┌──────────────────────── render hot path ────────────────────────┐
   stdin JSON ──▶ │  core ──▶ data ──▶ widgets ──▶ render ──▶ write (one syscall)   │ ──▶ ANSI on stdout
                  └─────────────────────────────────────────────────────────────────┘
                       ▲                                                ▲
                       │ imports allowed (left to right only)           │ no imports back
                       │                                                │
                       └─── commands  (install/uninstall/reset/doctor/update-check)
                       └─── tui       (editor + picker + preview + state + keys)
                                       ← reached ONLY via runtime URL import in src/cli/cli.ts
                                          gate-19 fails the build on any static import of
                                          ink / react / src/tui/ from a render-reachable file
```

`core` imports nothing from `src/`. Each group imports only from groups to its left (gate-25 enforces). `tui/` is an island reachable only by the lazy URL string in `src/cli/cli.ts`. `commands/` is dispatched at the top of the CLI but stays ink/react/`src/tui/`-free so it does not pull the editor into cold start.

## Where to read before editing

| Path                             | Read before editing                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `src/core/CLAUDE.md`             | Atomic-write, stdin bounds, schema, i18n boundaries                          |
| `src/data/CLAUDE.md`             | Resolvers, snapshots, config layering — group-level contracts                |
| `src/data/config/CLAUDE.md`      | Config merge / validate / mutate — leaf hard contract                        |
| `src/data/git/CLAUDE.md`         | invoke → parse → snapshot waterfall + optional PR lookup                     |
| `src/data/state/CLAUDE.md`       | Per-cache contracts (stdin-cache, render-cache, backup, version-check-cache) |
| `src/data/tokens/CLAUDE.md`      | Transcript → aggregate → context-window/speed; reset-axis discipline         |
| `src/widgets/CLAUDE.md`          | Plumbing siblings + families/ catalogue + per-family folders                 |
| `src/widgets/families/CLAUDE.md` | Catalogue ↔ registry parity, family identity, dictionary contract            |
| `src/widgets/git/CLAUDE.md`      | git widgets, snapshot consumption, optional PR lookup                        |
| `src/widgets/tokens/CLAUDE.md`   | Reset-axis discipline, format/options/speed sub-folders                      |
| `src/render/CLAUDE.md`           | Pipeline, composition, ANSI — the hot path                                   |
| `src/render/render/CLAUDE.md`    | Goldens, determinism contract, width math, one-syscall write                 |
| `src/tui/CLAUDE.md`              | Editor group — picker/preview/state/keys are siblings of tui/                |
| `src/tui/tui/CLAUDE.md`          | Editor leaf — reducer, preview parity, lazy-import mechanics                 |
| `src/commands/CLAUDE.md`         | install/uninstall/reset/doctor/update-check verb contracts                   |
| `tests/gates/CLAUDE.md`          | Gate suite conventions: numbering, `lib/common.sh`, how to add a gate        |
| `agents/CLAUDE.md`               | Claude skill files copied into the host by `agentline install`               |

## Gate map

Lookup table — full spec lives in `docs/cookbook/14-gates-catalogue.md`. Run `bash tests/gates/run-all.sh` before opening a PR.

| Gate    | Protects                        | Typical failure                                                                               |
| ------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| gate-01 | doctor smoke                    | Host wiring missing on a fresh bootstrap                                                      |
| gate-02 | no absolute paths in artefacts  | A `/Users/` / `/home/` / `~/.claude/` literal in a shipped file                               |
| gate-03 | shellcheck                      | Shell-script lint regressions under `tests/gates/` or `scripts/`                              |
| gate-05 | markdown formatting             | Unformatted markdown — run `npx prettier --write`                                             |
| gate-06 | trademark / brand strings       | Restricted brand string introduced into shipped text                                          |
| gate-11 | schema ↔ template round-trip    | Schema drift from `templates/default.config.json`                                             |
| gate-13 | cold-start budget               | Process-start to first byte over the budget in `docs/GLOSSARY.md`                             |
| gate-14 | no network at render time       | Outbound request added to a render-reachable module                                           |
| gate-15 | platform matrix                 | macOS / Linux / WSL parity regression                                                         |
| gate-16 | accessibility fallbacks         | `--no-color` / `--no-unicode` / `--ascii` regression                                          |
| gate-17 | keymap coverage                 | Documented editor action missing / malformed in `dist/keys.mjs`                               |
| gate-18 | changelog fragment present      | PR missing a `changelog/<branch>.md` fragment                                                 |
| gate-19 | no TUI/ink/react in render path | **Most load-bearing:** static import of ink / react / `src/tui/` from a render-reachable file |
| gate-20 | docs glossary parity            | README widget count out of sync with catalogue, or retired term in docs                       |
| gate-21 | source-comment glossary parity  | Retired term in a source comment                                                              |
| gate-22 | glossary self-consistency       | Glossary count or type-table path out of sync with code                                       |
| gate-23 | dependency audit                | New runtime dep unpinned or with a known advisory                                             |
| gate-24 | secret scan                     | Credential-shaped literal in a tracked file                                                   |
| gate-25 | layer import direction          | Reverse import (e.g. `core` → `data`)                                                         |
| gate-26 | i18n dictionary contract        | Unknown id prefix, or two different English fallbacks for one id                              |

## When you need to know X, read Y

| Question                                 | Read                                          |
| ---------------------------------------- | --------------------------------------------- |
| What does this term mean?                | `docs/GLOSSARY.md` (authoritative)            |
| Why is the architecture shaped this way? | `docs/cookbook/04-architecture.md`            |
| What pattern is being applied?           | `docs/cookbook/05-design-patterns.md`         |
| Stage input/output contract              | `docs/cookbook/06-data-contracts.md`          |
| Widget contract / family identity        | `docs/cookbook/07-component-specs.md` (§7.1)  |
| Why this decision? (D-001 … D-013)       | `docs/cookbook/10-tradeoffs-and-decisions.md` |
| Repo layout rationale                    | `docs/cookbook/11-repo-layout.md`             |
| Testing strategy & golden format         | `docs/cookbook/13-testing-strategy.md`        |
| Gate pass/fail conditions                | `docs/cookbook/14-gates-catalogue.md`         |
| Release & changelog workflow             | `docs/cookbook/16-release-and-versioning.md`  |
| PR / branch / commit conventions         | `docs/PR-CONVENTIONS.md`                      |

## Test / verify quick-recipes

```sh
# Run only the suite for the subtree you touched
pnpm exec vitest run src/<group>[/<leaf>]

# Run all gates locally before opening a PR
bash tests/gates/run-all.sh

# Update a golden intentionally (after confirming the diff is exactly the intended delta)
pnpm exec vitest run src/render/render -u   # then commit tests/golden/<scenario>/expected.ansi

# Format markdown before commit — gate-05 rejects unformatted markdown
npx prettier --write CLAUDE.md '**/CLAUDE.md' docs/**/*.md
```

## Naming policy

| Artefact  | Pattern                        | Example                           |
| --------- | ------------------------------ | --------------------------------- |
| TS source | feature-folder under `src/`    | `src/widgets/git/branch.ts`       |
| Themes    | `<kebab-case>.json`            | `claude-code-dark.json`           |
| Branch    | `<type>/agentline-<NN>-<slug>` | `feat/agentline-06-config-loader` |

## Non-goals (v0.1.0)

Plugin distribution (`.claude-plugin/`), native binaries, Homebrew, curl-installer, Bun/Deno-tested runtimes, Powershell-native scripts, telemetry, remote update checks, dynamic-library / WASM widget plugins, marketplace listing automation.

## Quick commands

| Command                                             | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `corepack enable && pnpm install && pnpm run build` | Bootstrap and build (pnpm is pinned via `packageManager`) |
| `pnpm test`                                         | Unit tests                                                |
| `bash tests/gates/run-all.sh`                       | Run all repo gates                                        |
| `node dist/cli.mjs install --from-source`           | Wire statusline + install skills locally                  |
| `node dist/cli.mjs edit`                            | Open the TUI editor                                       |
| `pnpm run preview:watch`                            | Live-reload preview while editing config                  |
| `bash scripts/install.sh --dry-run`                 | Preview the install actions (legacy)                      |
| `bash scripts/doctor.sh`                            | Diagnose host configuration (legacy)                      |

## Source layout

Core modules live under `src/`, organised into six nested groups. The CLI
bin entry (`src/cli/cli.ts`) and `src/version.ts` are the only files at
the `src/` root level.

The repo follows a **feature-folder rule**: when two or more files in a
directory share a stem or prefix (`foo.ts` + `foo.test.ts`, or
`picker.ts` + `picker-helpers.ts`), they live in a feature folder named
after that stem/prefix. Singletons and `index.ts` barrels stay flat.

| Group           | Purpose                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/`     | Stdin parse, schema, i18n (`en-dictionary` + `ids` contract), shared pure libs                                                             |
| `src/data/`     | Config, theme, tokens, git, session, on-disk state (`config`, `theme`, `tokens`, `git`, `session`, `state`)                                |
| `src/widgets/`  | Per-family widget folders + `families/` (catalog + family-identity) + plumbing (`cell`, `clock`, `registry`, `render-widget`, `separator`) |
| `src/render/`   | Line composer + powerline transform (`render`, `powerline`)                                                                                |
| `src/tui/`      | Lazy-imported TUI editor: `tui/` (app shell), `picker/`, `preview/`, `state/`, `keys/`                                                     |
| `src/commands/` | Verb implementations (`doctor`, `install`, `uninstall`, `reset`, `update-check`, `cli`)                                                    |

Representative leaf paths: `src/core/lib/<feature>/`, `src/core/stdin/`,
`src/data/config/<feature>/`, `src/data/theme/`, `src/data/state/<cache>/`,
`src/render/render/<stage>/`, `src/render/powerline/`, `src/tui/tui/`,
`src/tui/picker/`, `src/tui/preview/`, `src/tui/state/`,
`src/tui/keys/`, `src/widgets/families/`, `src/widgets/<family>/<widget>/`,
`src/commands/doctor/<verb>/`, `src/commands/install/`,
`src/commands/uninstall/`, `src/cli/`.

## When in doubt

Check `docs/` and `docs/cookbook/` for design intent. If the docs are silent, open an issue rather than inventing behaviour.
