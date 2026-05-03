# Contributing to `agentline`

Thanks for considering a contribution. This document covers the dev environment, branch / commit / merge conventions, and the gate command every PR must satisfy.

## Dev environment

Prerequisites:

- Node ≥20 LTS (`node --version`)
- npm ≥10 (`npm --version`)
- bash 3.2+ (`bash --version`)
- `git` on PATH
- Optional: `shellcheck`, `markdownlint-cli2`, `prettier` (CI installs these; locally only needed if you want to run gates without a network round-trip)

Bootstrap:

```bash
npm i
npm run build
bash tests/gates/run-all.sh
```

## Branching

Branch from `main`. Branch name format:

```
<type>/agentline-<NN>-<slug>
```

Where `<NN>` is the zero-padded PR number from [`docs/plan/PR-PLAN.md`](docs/plan/PR-PLAN.md). Full conventions live in [`docs/plan/PR-CONVENTIONS.md`](docs/plan/PR-CONVENTIONS.md).

## Commits

Conventional Commits:

```
<type>(<scope>): <subject>
```

`<type>` ∈ `feat | fix | chore | docs | test | refactor | perf | ci`.
`<scope>` ∈ the closed list defined in `docs/plan/PR-CONVENTIONS.md`.

Body answers _why_, citing the spec section (e.g. `per §7.3`).

## Tests & gates

Every PR runs:

```bash
bash tests/gates/run-all.sh   # repo gates
npm test                      # unit tests
npm run build                 # build verification
```

CI runs the same on every supported host × Node version. Failures block merge.

## Pull requests

PR title matches the leading commit subject. PR body uses the template in `docs/plan/PR-CONVENTIONS.md`:

- `## What`
- `## Why` (spec citation)
- `## Gates exercised`
- `## Depends on`
- `## Test plan`
- `## Out of scope`

Add an entry to `CHANGELOG.md` under `[Unreleased]` in the appropriate group.

## Spec changes

The spec in `docs/plan/SPEC-v0.1.0.md` is normative. Behaviour changes that diverge from the spec must update the spec in the same PR, with the divergence motivated in the PR's `## Why`.

## Release process

Release-tag PRs follow `docs/plan/SPEC-v0.1.0.md` §14. Maintainers only.

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Vulnerabilities: see [SECURITY.md](SECURITY.md). Do not open public issues for security findings.
