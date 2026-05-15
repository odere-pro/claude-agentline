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
npm i             # first-time setup; or `npm ci` for a deterministic install from package-lock.json
npm run build
bash tests/gates/run-all.sh
```

CI and reproducible builds should always use `npm ci` — runtime deps are exact-pinned, dev deps use caret ranges that `npm ci` resolves strictly against the lockfile.

## Running agentline locally

After `npm run build`, the compiled bin lives at `dist/cli.mjs`. Three ways to invoke it during development:

```bash
# 1. Direct — no global link, no PATH changes. Best for quick iteration.
node dist/cli.mjs doctor
node dist/cli.mjs config show

# 2. npm link — puts `agentline` on PATH, pointing at this checkout.
npm link                # one-time
agentline doctor

# 3. Full local install — same as `npm link` plus seeds config, themes,
#    skills, and wires Claude Code's statusLine setting at this checkout.
node dist/cli.mjs install --from-source
```

`(2)` and `(3)` create two symlinks under your npm global prefix (`npm prefix -g`):

- `<prefix>/lib/node_modules/@agentline/cli` → this checkout
- `<prefix>/bin/agentline` → the `dist/cli.mjs` inside this checkout

Rebuild with `npm run build` and the live `agentline` command picks up the change on its next invocation — no re-link needed.

**Gotcha — `dist/` must exist before `npm link`.** If you run `npm link` in a checkout where `dist/cli.mjs` is missing (fresh clone, or after `rm -rf dist`), npm still links the package directory but **silently skips creating the `agentline` bin** — and worse, if a prior `npm link` from another checkout had put `agentline` on PATH, that bin link gets dropped. Always `npm run build` first. If `agentline` suddenly stops resolving, check `ls -la "$(npm prefix -g)/bin/agentline"`; the fix is `npm run build && npm link` from the checkout you want it to point at.

The same applies if you have multiple checkouts (e.g. a worktree): `npm link` from a second checkout moves the global link to that checkout. Run it from the checkout you actually want `agentline` to resolve to.

### Iterate

Rebuild on save while you edit:

```bash
npx tsup --watch
```

Render a fixture (no Claude Code session needed; deterministic, offline):

```bash
node dist/cli.mjs render --fixture tests/golden/minimal/stdin.json
```

Or pipe a payload by hand:

```bash
echo '{"workspace":{"current_dir":"."}}' | node dist/cli.mjs
```

### Isolate from your real Claude Code config

Both `install` and `doctor --fix` write to `~/.claude/settings.json` and `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/`. Point them at a scratch dir while developing so you don't clobber your real setup:

```bash
export CLAUDE_CONFIG_DIR="$(mktemp -d)"
node dist/cli.mjs install --from-source
node dist/cli.mjs doctor
```

To clean up after a real-checkout install: `node dist/cli.mjs uninstall` (add `--purge` to also drop the config + themes that install seeded). It restores any prior `statusLine` from the backup written at install time.

### Tests during dev

```bash
npm test                 # one-shot
npm run test:watch       # vitest watch mode
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
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
