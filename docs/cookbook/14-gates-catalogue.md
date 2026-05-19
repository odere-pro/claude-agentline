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

- **Probes.** Iterates every scenario under `tests/golden/`; runs `<bin> render --fixture <scenario>`; diffs against `expected.ansi`.
- **Pass criterion.** All scenarios match byte-exactly.

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

## gate-22 · pricing-table freshness

- **Probes.** Regex-parses `PRICING_TABLE_VERSION` (and `PRICING_FRESH_MAX_DAYS`) out of `src/tokens/pricing.ts` and compares the embedded date against the budget.
- **Pass criterion.** The version literal parses as `YYYY-MM-DD` and is within the freshness budget (90 days by default).
- **Debugging.** If stale, refresh `src/tokens/pricing.ts` and bump `PRICING_TABLE_VERSION` as part of the next release. This is the local + PR signal that replaced the retired `doctor` D06 pricing check; the scheduled `pricing-skew.yml` workflow remains the monthly belt-and-suspenders.

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
