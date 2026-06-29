# Testing

`agentline` has three test surfaces:

| Surface          | Tool         | What it covers                                              |
| ---------------- | ------------ | ----------------------------------------------------------- |
| **Unit tests**   | Vitest       | Pure functions, widgets, parsers, config layering.          |
| **Golden tests** | Vitest       | Byte-for-byte renderer determinism on recorded fixtures.    |
| **Repo gates**   | Bash + tools | Cross-cutting checks (no absolute paths, shellcheck, etc.). |

## Unit tests

```bash
pnpm test
```

Vitest discovers `src/**/*.test.ts` and the integration suite under
`tests/integration/`. The full run is ~30 s on a laptop. Single-file
runs:

```bash
npx vitest run src/widgets/git/branch.test.ts
npx vitest --watch
```

### Folder-per-feature placement

Every source file lives in a folder named after the feature, with the
test as its sibling. Adding a new utility called `foo` looks like:

```
src/<area>/foo/
├── foo.ts
└── foo.test.ts
```

Same shape for widgets (`src/widgets/git/worktree/worktree.ts` + `worktree.test.ts`),
data resolvers, render stages, and TUI modules. Aggregate tests
(`git-widgets.test.ts`, `rate-limit-widgets.test.ts`) are transitional —
they cover several widgets whose source files have not yet been folder-
ized, and split once the underlying widgets do.

Use the Arrange / Act / Assert structure and prefer test names that
describe behaviour, not internals.

### Shared helpers

The factory and sandbox helpers live under
[`src/test-helpers/`](../src/test-helpers/) and are imported only by
`*.test.ts` files (enforced by ESLint). The barrel exports:

| Helper                           | Use it for                                                              |
| -------------------------------- | ----------------------------------------------------------------------- |
| `makeWidgetContext`              | `WidgetContext` with `stdin`/`config`/`theme`/`clock`/`env` set.        |
| `makeGitSnapshot`                | Clean-default `GitSnapshot` (`branch: "main"`, `pr: null`).             |
| `makeTokensSnapshot`             | `TokensSnapshot` with a 200k window and event-derived anchors.          |
| `makeTranscriptEvent`            | Zero-filled `TranscriptEvent` — often aliased to `ev`.                  |
| `makeStdinPayload`               | Empty `StdinPayload`; pass `contextWindow` / `rateLimits` as overrides. |
| `makeCell`                       | Frozen `Cell` for render unit tests.                                    |
| `frozenClock` / `canonicalClock` | Deterministic clock; `CANONICAL_TEST_INSTANT` is the shared default.    |
| `withTmpDir`                     | Allocate a tmpdir, run `fn(dir)`, always clean up.                      |
| `withSandbox`                    | The `home` + `cfgDir` + `cwd` triple for CLI tests.                     |

Every factory accepts a `Partial<T>` of overrides spread last, so tests
say what they care about and inherit the rest:

```ts
import { makeGitSnapshot, makeWidgetContext } from "../../test-helpers/index.js";

const ctx = makeWidgetContext({
  git: makeGitSnapshot({ branch: "feat/x" }),
});
```

If a test legitimately needs a different default (file-local
conventions, e.g. a pinned `FIXED_NOW_MS` in `rate-limit-widgets.test.ts`),
keep a thin file-local wrapper that composes the shared factory.

## Golden (renderer-determinism) tests

The renderer must produce byte-identical output for the same inputs
across hosts and runs. Each scenario under `tests/golden/` ships:

| File            | Contents                                   |
| --------------- | ------------------------------------------ |
| `stdin.json`    | the Claude Code stdin payload              |
| `config.json`   | the `AgentlineConfig` to render against    |
| `clock.txt`     | ISO timestamp the renderer freezes time at |
| `expected.ansi` | the exact bytes the renderer must emit     |

The harness in `src/render/render/__golden__.test.ts` walks every directory
and asserts `renderForFixture(...) === expected.ansi`.

### Adding a scenario

```bash
mkdir tests/golden/my-scenario
# Drop in stdin.json, config.json, clock.txt.
agentline render --fixture tests/golden/my-scenario/stdin.json \
  --config  tests/golden/my-scenario/config.json \
  --frozen-clock "$(cat tests/golden/my-scenario/clock.txt)" \
  > tests/golden/my-scenario/expected.ansi
npm test  # confirms the harness picks it up
```

### Regenerating after an intentional renderer change

If a PR legitimately changes rendered output, regenerate every
affected scenario in the same PR. Reviewers can diff `expected.ansi`
to confirm the change is wanted.

## Repo gates

```bash
bash tests/gates/run-all.sh
```

The orchestrator runs every `gate-*.sh` under `tests/gates/`. Each
gate is a single-purpose Bash script with `pass` / `fail` / `skip`
output. Gates currently shipped:

| Gate                                 | Enforces                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| `gate-01-doctor`                     | `agentline doctor` exits 0 on a clean host                     |
| `gate-02-no-absolute-paths`          | no `/Users/`, `/home/`, `~/.claude/` literals in artefacts     |
| `gate-03-shellcheck`                 | shellcheck clean across `scripts/` and `tests/gates/`          |
| `gate-05-markdown`                   | markdownlint + prettier clean on `docs/` and root markdown     |
| `gate-06-trademark`                  | "Anthropic", "Claude" used only inside an allowlist            |
| `gate-11-schema-roundtrip`           | every shipped template validates against the embedded schema   |
| `gate-13-cold-start-budget`          | `agentline render` cold-start ≤ 120 ms p95                     |
| `gate-14-no-network-render`          | render path makes no outbound network call                     |
| `gate-15-platform-matrix`            | install + render smoke on macOS / Linux / Windows × Node 20/22 |
| `gate-16-accessibility-fallbacks`    | `--no-color`, `--no-unicode`, `--ascii` change output          |
| `gate-17-keymap-coverage`            | every TUI keymap entry has a corresponding registered handler  |
| `gate-18-changelog-fragment-present` | each PR ships a `changelog/<NN>-<slug>.md`                     |

Skipped gates (`[skip]`) are usually waiting on a host tool — install
`shellcheck`, `markdownlint-cli2`, `prettier`, and `ajv-cli` to clear
the most common skips. CI runs every gate on the full host matrix.

### Running a single gate

```bash
bash tests/gates/gate-13-cold-start-budget.sh
```

## Cold-start bench

```bash
node scripts/bench/cold-start.mjs
```

Measures p50 / p95 / p99 of `agentline render` against a fixed
fixture. The §1.2 N2 budget is **120 ms p95**. `gate-13` enforces it
in CI.

## Adding a widget — full TDD recipe

1. **Write the test first** — `src/widgets/<family>/<name>.test.ts`.
   Cover the happy path, the `hidden: true` path, and at least one
   options edge case (e.g. `format: "human"`).
2. **Implement** — `src/widgets/<family>/<name>.ts`. Use
   `defineWidget<Options>("<name>", (ctx, settings) => …)`.
3. **Register** — add the export to `src/widgets/registry/registry.ts` next to
   its family.
4. **Lock determinism** — drop a fixture under `tests/golden/` that
   exercises the new widget; commit `expected.ansi`.
5. **Document** — add a row to `docs/widgets.md` in the right family
   table; update the family count if needed.
6. **Verify** — `npm test && bash tests/gates/run-all.sh`.

## Coverage

The §1.2 N2 cold-start budget is enforced; line coverage is
informational. Run `npx vitest run --coverage` for a local report
(install `@vitest/coverage-v8` on demand). CI does not gate on a
coverage percentage today.
