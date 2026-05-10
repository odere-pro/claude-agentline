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

## Changelog fragments

Every user-visible PR adds one Markdown fragment under `changelog/`. File names follow `<NN>-<slug>.md` where `<NN>` is the zero-padded PR sequence number from `docs/plan/PR-PLAN.md` and `<slug>` is the kebab-case branch slug (≤ 32 chars).

Each fragment is exactly **one bullet** leading with intent, ending with a period. Do not prefix with a commit SHA — `scripts/changelog-aggregate.sh` resolves the introducing commit and prepends the short hash at release time. The aggregator is run with `--apply` only inside the release PR; on every other PR the fragment sits in its own file so two in-flight PRs cannot conflict on the changelog.

Full rules and rationale: [`changelog/README.md`](changelog/README.md).

## Adding a widget

Five steps end-to-end:

1. Define the widget interface and a pure render function in `src/widgets/<family>/<name>.ts`. No I/O, no wall-clock outside `ctx.clock`, no network. The render path must hide the widget cleanly when its context data is absent.
2. Register the widget in `src/widgets/registry.ts` next to its family entry so it can be referenced from config.
3. Add a unit test next to the source as `src/widgets/<family>/<name>.test.ts`. Cover the present, absent, and degraded-input cases.
4. Add a golden fixture under `tests/golden/<scenario>/` with `input.json` and `expected.txt` so determinism is locked in and gate 11 (`schema-roundtrip`) keeps the wire shape stable.
5. Document the widget in [`docs/widgets.md`](docs/widgets.md): id, options table, reset axis if applicable, and a link to the fixture.

The `add-widget` skill scaffolds all five steps. The `widget-check` skill verifies the contract before review.

## Reporting issues

Three templates live under `.github/ISSUE_TEMPLATE/`:

- [`bug.md`](.github/ISSUE_TEMPLATE/bug.md) — something misbehaves on a supported host.
- [`feature.md`](.github/ISSUE_TEMPLATE/feature.md) — propose new behaviour or a new widget.
- [`gate-failure.md`](.github/ISSUE_TEMPLATE/gate-failure.md) — a §11.2 gate failed in CI or locally.

Security findings do **not** go through issues — see [`SECURITY.md`](SECURITY.md).

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Vulnerabilities: see [SECURITY.md](SECURITY.md). Do not open public issues for security findings.
