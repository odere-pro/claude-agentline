# PR Conventions — `agentline`

## Branch naming

`<type>/agentline-<NN>-<slug>` where:

- `<type>` ∈ { `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci` } and matches the leading commit's type.
- `<NN>` is the zero-padded PR sequence number from [PR-PLAN.md](./PR-PLAN.md).
- `<slug>` is kebab-case, ≤32 chars, no leading/trailing dashes.

Branch names MUST NOT be reused after merge. Delete on merge.

## Commit format (Conventional Commits)

`<type>(<scope>): <subject>`

`<scope>` ∈ { `cli`, `config`, `render`, `theme`, `widgets`, `git`, `tokens`, `session`, `tui`, `doctor`, `script`, `ci`, `docs`, `plan`, `tests`, `deps`, `repo` }.

Body answers _why_, not _what_. Cite the spec section when the change is normative-driven (e.g., `per §7.3 reset axes`).

## PR title

Same shape as the leading commit subject: `<type>(<scope>): <subject>`.

## PR body template

```markdown
## What

One paragraph; the change in plain English.

## Why

Spec citation(s) (§N.M) and/or issue link.

## Gates exercised

List of §11 gate IDs newly satisfied or kept passing.

## Depends on

PR links the reviewer must merge first.

## Test plan

- [ ] `bash tests/gates/run-all.sh`
- [ ] `npm test`
- [ ] `npm run build` (verifies `dist/` is publishable)
- [ ] additional scenario steps

## Out of scope

Bullets with rationale for each deferral.
```

## Merge rules

- All CI workflows green; one approving review; no unresolved comments; dependencies merged.
- `[Unreleased]` entry added under the appropriate group in `CHANGELOG.md`.
- Branch from `main`; rebase (not merge) `main` into the branch when stale.
- Squash-merge for `chore`, `docs`, `plan`, hotfix; merge-commit (no squash) for feature PRs to preserve internal sequence.

## Forbidden

- `--no-verify`, `--no-gpg-sign`.
- Unbounded version ranges in any pinned runtime dependency (per §1.2 N11).
- Net-new absolute paths in artefacts (`/Users/`, `/home/`, `~/.claude/` literals; gate 03 enforces).
- Network calls in the render hot path.
