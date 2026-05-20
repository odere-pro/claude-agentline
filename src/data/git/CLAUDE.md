# CLAUDE.md — `src/data/git`

> Mid-level map. Group-level boundary rules live in `src/data/CLAUDE.md`; this file is the per-stage map for the git snapshot.

## Scope

The waterfall that turns the local working tree into a frozen git snapshot widgets consume, plus the optional PR lookup:

- `invoke/` — the **only** place in the repo that spawns `git` as a child process.
- `parse/` — pure text-to-typed-struct transform of `git` output.
- `snapshot/` — composes working-tree status + branch + ahead/behind into a single frozen snapshot.
- `pr/` — optional PR lookup; may be absent.

Pipeline position: core → **data/git** → widgets/git → render.

## Map

```
src/data/git/
├── invoke/    spawn git (child process) — ONLY place that runs an executable
├── parse/     pure: git text → typed git struct
├── snapshot/  compose working-tree + branch + ahead/behind into a frozen snapshot
└── pr/        optional PR lookup (may be absent — widgets hide rather than error)

  Widgets never invoke git themselves; they consume the frozen snapshot.
```

Pattern: **Frozen snapshot for I/O resolvers** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/data/git
```

Tests stub `invoke/` with canned `git` output; `parse/` and `snapshot/` are exercised against fixture text.

## Invariants you must not break

- **`invoke/` is the single sanctioned child-process site for git.** No other file in `src/data/git/` (or anywhere else in the repo) may spawn `git`. If you need new data, extend `invoke/` and `parse/`; do not shell out from a widget or another resolver.
- **Hide on absence.** Missing `git` binary, non-git directory, or failed invocation → the snapshot reports the relevant absence and the dependent widget hides. Never throw upward into the render path.
- **`pr/` is optional.** PR data may legitimately be unavailable (no remote, no `gh`, network-down). Treat absence as the default; never block render on it.
- **One snapshot per tick.** `snapshot/` is read once per render tick into a frozen value; widgets re-query the snapshot, not the underlying source.
- **Determinism in tests.** All test scenarios feed fixture text into `parse/` — the suite must not spawn a real `git`.

## Applied patterns

- **Frozen snapshot for I/O resolvers** — widgets consume the snapshot, never invoke git themselves.

See `docs/cookbook/05-design-patterns.md`.

## How to test this area

- `pnpm exec vitest run src/data/git` — per-stage suites: invoke contract, parse correctness, snapshot composition, PR-absent path.
- gate-14 (no-network-render) — the render path stays network-free even with PR lookup wired in.

## When in doubt

Owning chapter: `docs/cookbook/06-data-contracts.md` and `05-design-patterns.md`.
