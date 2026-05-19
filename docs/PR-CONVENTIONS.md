# PR Conventions — `agentline`

## Branch naming

`<type>/agentline-<NN>-<slug>` where:

- `<type>` ∈ { `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci` } and matches the leading commit's type.
- `<NN>` is the next zero-padded PR sequence number (one greater than the highest already used).
- `<slug>` is kebab-case, ≤32 chars, no leading/trailing dashes.

Branch names MUST NOT be reused after merge. Delete on merge.

## Commit format (Conventional Commits)

`<type>(<scope>): <subject>`

`<scope>` ∈ { `cli`, `config`, `render`, `theme`, `widgets`, `git`, `tokens`, `session`, `tui`, `doctor`, `script`, `ci`, `docs`, `plan`, `tests`, `deps`, `repo` }.

Body answers _why_, not _what_. Cite the issue or rationale that motivates the change.

## PR title

Same shape as the leading commit subject: `<type>(<scope>): <subject>`.

## PR body template

```markdown
## What

One paragraph; the change in plain English.

## Why

Issue link and/or the rationale that motivates the change.

## Gates exercised

List of repo gate IDs newly satisfied or kept passing.

## Depends on

PR links the reviewer must merge first.

## Test plan

- [ ] `bash tests/gates/run-all.sh`
- [ ] `pnpm test`
- [ ] `pnpm run build` (verifies `dist/` is publishable)
- [ ] additional scenario steps

## Out of scope

Bullets with rationale for each deferral.
```

## Merge rules

- All CI workflows green; one approving review; no unresolved comments; dependencies merged.
- Changelog fragment dropped under `changelog/<NN>-<slug>.md` (one bullet, no SHA prefix; the aggregator script promotes fragments into `CHANGELOG.md` at release time). See `changelog/README.md` for the full convention.
- Branch from `main`; rebase (not merge) `main` into the branch when stale.
- Squash-merge for `chore`, `docs`, `plan`, hotfix; merge-commit (no squash) for feature PRs to preserve internal sequence.

## Author maintenance

Once a PR is open, the author is responsible for keeping it green and
mergeable until the reviewer hits merge:

- **Check the PR's CI status before declaring it ready for review.** Use
  `gh pr checks <num>` or open the PR page. A red status counts as "not
  ready".
- **If CI/CD is broken, fix it.** Investigate the failing step, push the
  fix, and confirm the next run is green. Do not mark the PR ready, ping
  reviewers, or move on to the next PR until CI is green.
- **If the PR has merge conflicts with `main`, fix them.** Rebase the
  branch on the latest `main`, resolve conflicts, re-run
  `bash tests/gates/run-all.sh` locally, and force-push with
  `--force-with-lease`. Conflicts on `changelog/` fragments should be
  rare-to-impossible by design (one fragment file per PR); conflicts on
  shared source files should be resolved by understanding both sides, not
  by blanket-accepting either.
- **Never bypass safety controls** (`--no-verify`, `--no-gpg-sign`,
  disabling required checks) to land a PR. Fix the underlying problem.

## Forbidden

- `--no-verify`, `--no-gpg-sign`.
- Unbounded version ranges in any pinned runtime dependency.
- Net-new absolute paths in artefacts (`/Users/`, `/home/`, `~/.claude/` literals; gate 03 enforces).
- Network calls in the render hot path.
