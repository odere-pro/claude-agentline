# `changelog/` — fragment-per-PR changelog

This directory holds one Markdown fragment per merged PR. The aggregator
script (`scripts/changelog-aggregate.sh`) promotes the fragments into the
`[Unreleased]` block of `CHANGELOG.md` at release time.

The point: every PR writes to its own file, so two PRs in flight cannot
conflict on the changelog. No more rebase-driven `git stash` dances.

## File naming

`changelog/<NN>-<slug>.md` where:

- `<NN>` is the next zero-padded PR sequence number (one greater than the highest already used).
- `<slug>` is kebab-case, ≤ 32 chars, identical to the branch's slug.

If a PR is genuinely outside the planning sequence, use a unique slug
prefixed with the PR's branch type (e.g. `chore-tidy-readme.md`).

## File content

Exactly one bullet, leading with intent, ending with a period. **Do not
prefix with the commit SHA** — the aggregator resolves the introducing
commit per fragment via `git log` and prepends the short SHA on
aggregation.

The bullet shape mirrors the in-repo memory rule:

```markdown
- <Intent / goal>: <what changed>.
```

Multi-clause is fine; multi-paragraph is not. No spec-section citations
inside the fragment — those belong in the commit body and PR description.

## When to write a fragment

Every PR that ships a user-visible change writes a fragment. PRs that are
purely internal (rebase merges, repo housekeeping that the consumer cannot
observe) MAY skip the fragment; reviewers may push back if they think the
change is observable.

## Aggregation

Run `bash scripts/changelog-aggregate.sh` for a dry-run preview.
Run `bash scripts/changelog-aggregate.sh --apply` to inline the fragments
into `CHANGELOG.md` and remove them from `changelog/`. The release PR is
the canonical place to do this.

Bullets land under `### Added` inside `## [Unreleased]`. Pass
`--section Fixed` (or `Changed`, `Removed`, `Security`) to fold somewhere
else; the heading is created if the block does not already carry it. A
failed `--apply` leaves `CHANGELOG.md` and every fragment untouched.
