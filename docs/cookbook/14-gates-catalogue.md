# 14 · Gates catalogue

> **Intent:** For each gate, define topic, what it probes, pass criterion, and how to debug a failure.
> **Reads-with:** `13-testing-strategy`, `11-repo-layout`.

Gate IDs are **stable**. When a gate is retired, its slot is never reused.

Exit contract for every gate: `0` pass, `1` fail, `2` skipped (with a printed reason).

---

## gate-01 · doctor exits 0 on a healthy host

- **Probes.** `<bin> doctor` on a CI host that has been freshly bootstrapped.
- **Pass criterion.** Exit `0`; report shows D01–D08 all green or "not applicable".
- **Debugging.** Run `<bin> doctor --json` locally and inspect each check's status. Often this fails because the host config dir env var is missing in CI; gate the dependency explicitly.

## gate-02 · no absolute paths in shipped artefacts

- **Probes.** Greps the published-tarball contents for `/Users/`, `/home/`, `~/.claude/`.
- **Pass criterion.** No matches.
- **Debugging.** If matched, look at the build output where a path snuck in (a comment, a string literal, a JSON fixture). Replace with the env-var indirection.

## gate-03 · shell-lint

- **Probes.** Every `*.sh` (or equivalent script) under `scripts/` and `tests/gates/`.
- **Pass criterion.** Linter returns clean.
- **Debugging.** Run shellcheck locally on the failing file.

## gate-05 · markdown lint + format

- **Probes.** Markdown lint plus a formatter check across every `*.md` in the repo (excluding the auto-generated changelog from the formatter check).
- **Pass criterion.** Both pass.
- **Debugging.** Run the formatter locally with `--write`, then re-run the linter.

## gate-06 · trademark hygiene

- **Probes.** Greps the codebase for third-party trademarks; permitted occurrences live in an allowlist.
- **Pass criterion.** No matches outside the allowlist.

## gate-07 · install/uninstall roundtrip leaves a clean tree

- **Probes.** Runs `<bin> install` then `<bin> uninstall` against a temp host config dir; diffs the temp dir before and after.
- **Pass criterion.** Diff is empty.

## gate-08 · roundtrip preserves user-authored content

- **Probes.** Pre-existing user config and themes survive an install/uninstall cycle.
- **Pass criterion.** User-edited content (detected via SHA mismatch with the shipped template) is preserved unless `--purge`.

## gate-09 · install twice is idempotent

- **Probes.** Run `<bin> install` twice in a row.
- **Pass criterion.** Second run is a no-op (or reports already-installed); host state is unchanged.

## gate-10 · `--dry-run` matches the real run

- **Probes.** Compares the diff produced by `<bin> install --dry-run` against the diff produced by a real install (followed by `uninstall` to clean up).
- **Pass criterion.** Diffs are equivalent.

## gate-11 · schema round-trip

- **Probes.** `<bin> config schema` output validates against itself; the shipped `templates/*.config.json` files validate against the schema.
- **Pass criterion.** All validations pass.

## gate-12 · render determinism

- **Probes.** Iterates every scenario under `tests/golden/`; replays each through the published `dist/cli.mjs` (`render --fixture <scenario> --config … --frozen-clock … --no-color --width 80`) **twice** under a hermetic `env -i`; compares the two runs to each other and to `expected.ansi`.
- **Pass criterion.** Each scenario is byte-identical run-to-run **and** matches `expected.ansi`. Skips cleanly (exit 2) when `dist/` is unbuilt.

## gate-13 · cold-start budget

- **Probes.** Runs `<bin> render` n times with a 5-widget config; takes the p95 wall-clock from process start to last stdout byte.
- **Pass criterion.** p95 below the budget (~120 ms class on the reference host).

## gate-14 · no network at render time

- **Probes.** Runs `<bin> render` under a sandbox that denies network egress.
- **Pass criterion.** Render succeeds; no syscall attempt to connect.

## gate-15 · platform matrix smoke

- **Probes.** Installs the published artefact on the matrix (macOS × Linux × Windows × at least two runtime LTS lines) and runs `<bin> version`.
- **Pass criterion.** Exit `0` on every cell.

## gate-16 · accessibility fallbacks

- **Probes.** Runs `<bin> render` with `--no-color`, `--no-unicode`, `--ascii` against a golden scenario; asserts the output is semantically equivalent (no ANSI escapes / no Unicode / pure ASCII respectively).
- **Pass criterion.** Output passes the per-flag character-class checks and the byte-exact compare with the flag-specific golden.

## gate-17 · keymap coverage

- **Probes.** Every binding documented in `docs/keymap` MUST be present in the compiled keymap registry; the registry MUST NOT contain undocumented bindings.
- **Pass criterion.** Symmetric difference is empty.

---

## Project-local gates (stable but not in the universal spec)

These gates may be added per-implementation; the IDs are kept stable.

## gate-18 · changelog fragment present

- **Probes.** PRs that touch user-visible behaviour MUST include a changelog fragment under `changelog/<NN>-<slug>`.
- **Pass criterion.** At least one new fragment file in the PR diff.

## gate-19 · render path does not import TUI

- **Probes.** The import graph of every render-path entry point.
- **Pass criterion.** No path reaches the TUI framework module.

## gate-20 · glossary check

- **Probes.** Terms defined in `docs/GLOSSARY` are referenced consistently across the docs (no synonym drift).
- **Pass criterion.** Linter pass.

## gate-21 · comment-glossary alignment

- **Probes.** Glossary terms used inside source comments use the canonical spelling.
- **Pass criterion.** No mismatches.

## gate-22 · glossary self-consistency

- **Probes.** Derives every count, table row, and type-path the glossary claims and compares each against the code it documents. Six sub-checks: (1) the `## Built-in widget types (N total)` heading in `docs/GLOSSARY.md` matches the widget total from the catalog; (2) each per-family heading count (`### Session family (N)`, etc.) matches the catalog count for that family; (3) no literal gate-count claim survives in the glossary prose; (4) every file path in the `## TypeScript types` table resolves on disk and contains the canonical `export` declaration for that type; (5) every kebab-case widget type listed in a glossary family table has a matching entry in `src/widgets/families/<family>.ts`, and vice versa; (6) any `<!-- agentline:count name="<key>" -->N<!-- /agentline:count -->` marker present in `SOFTWARE-3-0.md` (opt-in; silently skipped when absent) matches the derived value — currently `agents-skills` (count of files under `agents/`) and `claude-md` (count of `CLAUDE.md` files in the repo).
- **Pass criterion.** Every derived count and type-path matches the doc; a wrong count or missing file fails. Strict, offline.
- **Debugging.** Do not hand-edit counts in the glossary. Fix the code or the glossary entry and re-run; the gate reports the claimed value, the derived value, and the source location for each mismatch.

## gate-23 · dependency audit

- **Probes.** Runs the package manager's audit on production runtime dependencies; PR-time complements include a SAST scan and a dependency-review action (`17-security-and-compliance · I-11`).
- **Pass criterion.** No advisories at the configured severity threshold (the reference implementation uses `moderate`).
- **Debugging.** Inspect the per-advisory output; bumping a transitive dep usually means waiting for a fix upstream or pinning a known-good version with a documented exception.

## gate-24 · secret scan

- **Probes.** Greps tracked files for credential-shaped literals using a vetted rule set; pairs with the platform's native secret-scanning + push-protection as a backstop (`17-security-and-compliance · Secret handling`).
- **Pass criterion.** No matches outside the explicit allowlist.
- **Debugging.** Rotate any matched secret immediately; replace the literal with an env-var indirection.

## gate-25 · layer import direction

- **Probes.** The static-import graph of `src/core/`, `src/data/`, `src/render/`, and `src/widgets/`. None may import from `src/commands/`; each must also obey the documented within-group direction (`core` imports nothing from `src/`; `data` imports only from `core`; `render` imports from `core`/`data`/`widgets`).
- **Pass criterion.** No reverse or cross-layer imports detected. Logs `file:line` for every violation.
- **Debugging.** The most common cause is a helper that grew an import from a higher layer — move the helper into the lower layer, or duplicate the small piece you actually need.

## gate-26 · i18n dictionary contract

- **Probes.** Every translator call in the source tree against `src/core/i18n/ids.ts` (registered prefixes) and `src/core/i18n/en-dictionary.ts` (authored English). Three sub-checks: (a) literal ids start with a registered prefix, (b) every dictionary-form id is a key in `EN_DICTIONARY`, (c) no id appears with two different literal-en fallbacks.
- **Pass criterion.** All three sub-checks clean.
- **Debugging.** A missing entry: add it to `EN_DICTIONARY`. A duplicate fallback: pick one canonical English and update the other call site. A typo in a prefix: rename to one of the registered prefixes (or add a new prefix in `ids.ts` and document why).

## gate-27 · citation existence

- **Probes.** Extracts every repo-path citation (`src/…`, `docs/…`, `tests/…`, `agents/…`, `scripts/…`, `templates/…`, `themes/…`, `changelog/…`), gate-id reference (`gate-NN`), and markdown link (`[text](path)`) from `docs/`, `CLAUDE.md`, and `SOFTWARE-3-0.md`. For each extracted path, asserts that the target resolves on disk (file or directory). Implemented in `tests/gates/gate-27-citation-existence.sh`.
- **Pass criterion.** Every cited path resolves; exit `0`. Strict: no partial passes. Offline (no network access required).
- **Debugging.** The gate prints each failing citation with its source file and line number. Either fix the path in the doc to point to the correct existing target, or (for intentional non-existence explanations) reword to remove the path literal. Do not introduce new path literals that do not exist.

## gate-28 · schema enum sync

- **Probes.** Runs `node scripts/gen-schema-enum.mjs --check`, which bundles the widget catalogue (`src/widgets/families/catalog.ts`) and asserts that the `widget.type` enum in `schemas/config.schema.json` equals the sorted catalogue keys and is prettier-formatted. The enum is generated by the `prebuild` step, so adding or removing a widget regenerates it with no hand-edit. Implemented in `tests/gates/gate-28-schema-enum-sync.sh`.
- **Pass criterion.** The checked-in schema matches the generator's output; exit `0`. Strict. Skips when node, esbuild, or prettier are unavailable (lean runtime install); CI installs devDeps and runs it.
- **Debugging.** Run `node scripts/gen-schema-enum.mjs` to regenerate the schema, then commit the result. The vitest mirror is `src/core/schema/embedded/schema-enum.test.ts`.

---

## Debugging a failing gate

The orchestrator (`tests/gates/run-all`) runs every gate independently and prints per-gate output. To debug a single gate:

```sh
bash tests/gates/gate-NN-<topic>.sh
```

Set `VERBOSE=1` (or whatever your framework uses) for additional logging. Gates that require a host context (gate-01, gate-13, gate-15) document the bootstrap they expect at the top of the file.

## When to add a new gate

A new gate is justified when:

- A class of regressions has slipped past unit tests twice.
- A behavioural invariant in the spec is not currently enforced.
- A non-functional requirement (budget, fallback) cannot be machine-checked any other way.

A new gate is unjustified when:

- It duplicates an existing gate.
- It checks an implementation detail rather than a behavioural invariant.
- It will be flaky on CI (gates MUST be deterministic).

## When to retire a gate

A gate retires when the invariant it checked is now enforced by a stronger mechanism (e.g. a type-system rule subsumes a runtime check). The retirement PR removes the gate file, leaves the ID slot empty in this catalogue, and notes the supersession.
