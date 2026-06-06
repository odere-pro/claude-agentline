# CLAUDE.md — `src/widgets/git`

> Mid-level map. Group-level boundary rules live in `src/widgets/CLAUDE.md`; the catalogue lives in `src/widgets/families/git.ts`.

## Scope

The git widget family. Two widgets live at the root (`branch.ts` → `git-branch`, `changes.ts` → `git-changes`); the remaining six live in sub-folders. All consume the frozen snapshot from `src/data/git/snapshot/` — they never invoke `git` themselves.

## Map

```
src/widgets/git/
├── branch.ts        git-branch       current branch name
├── changes.ts       git-changes      working-tree change counters
├── ahead-behind/    git-ahead-behind ahead / behind counters vs upstream; also git-conflicts
├── pr/              git-pr           optional PR widget (absent ⇒ hidden cell)
├── remote/          git-remote       git-upstream + git-origin-repo
└── sha/             git-worktree     worktree name when inside a worktree checkout

  All widgets consume data/git/snapshot/ (never invoke git themselves).
  Pure (ctx, settings) → Cell; absent snapshot ⇒ hidden cell.
```

Pattern: **Pure-function widget** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/widgets/git
```

`git-widgets.test.ts` exercises all widgets in this family against fixture snapshots.

## Invariants you must not break

- **Widgets are pure.** Each export is `(ctx, settings) → Cell`. No async, no I/O, no `git` spawn, no wall-clock except `ctx.clock`.
- **Consume the snapshot.** Read `ctx.git` (the frozen snapshot from `src/data/git/snapshot/`). If you need a new field, extend the snapshot upstream — do not call `git` here.
- **Absent snapshot ⇒ hidden cell.** Non-git directory, missing data, or absent optional sub-snapshot (e.g. PR) → return a hidden cell. Never throw.
- **PR is optional everywhere.** The `git-pr` widget hides if `ctx.git.pr` is absent; no error path.
- **Catalogue parity.** Every `type` registered here must appear in `src/widgets/families/git.ts`. Add the entry in the same change.

## Applied patterns

- **Pure-function widget** — referential transparency keeps goldens byte-stable.

See `docs/cookbook/05-design-patterns.md`.

## How to test this area

- `pnpm exec vitest run src/widgets/git` — per-widget rendered output, hidden-cell behaviour when the snapshot is absent, catalogue presence.

## When in doubt

Owning chapter: `docs/cookbook/07-component-specs.md` (§7.1). Snapshot shape: `src/data/git/CLAUDE.md`.
