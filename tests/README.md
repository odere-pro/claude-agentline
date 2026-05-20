# Tests

`agentline` keeps its unit tests **colocated** with the source they exercise. The repo follows a **folder-per-feature** layout: each `src/<area>/<feature>/<feature>.ts` has a sibling `src/<area>/<feature>/<feature>.test.ts`. Vitest discovers them automatically. This directory holds the slower, broader tests that don't fit alongside a single module.

The canonical TDD recipe (write-test → implement → register → document) lives in [`docs/testing.md`](../docs/testing.md). Shared factory + sandbox helpers live under [`src/test-helpers/`](../src/test-helpers/) — import them rather than re-rolling `makeSnapshot` / `makeCtx` inline.

## Layout

| Path                | Purpose                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `tests/integration` | End-to-end CLI flows that spawn `dist/cli.mjs` (install / uninstall, etc.). Slower; require `pnpm run build` first. |
| `tests/golden`      | Byte-equality fixtures for rendered ANSI output. See `tests/golden/README.md`.                                      |
| `tests/gates`       | Shell gates run from CI via `bash tests/gates/run-all.sh`. Not vitest — exit 0 = pass / 1 = fail / 77 = skip.       |

Cross-module invariants (registry parity, family aggregates, render-pipeline shape) live colocated under `src/widgets/` or `src/render/`; see `git-widgets.test.ts` and `__golden__.test.ts` for current examples.

## Running

```bash
pnpm test                        # full vitest suite (colocated + tests/)
npx vitest run src/widgets       # subset
npx vitest run path/to/foo.test.ts   # single file
bash tests/gates/run-all.sh      # gate suite (offline-friendly; tools auto-skip when absent)
```

## Adding a test

- **New module under `src/<area>/<feature>/`?** Add `feature.test.ts` next to `feature.ts`. That is the canonical surface.
- **Need a `WidgetContext`, `GitSnapshot`, `TokensSnapshot`, `Cell`, etc.?** Import the factory from `src/test-helpers/index.js` (`makeWidgetContext`, `makeGitSnapshot`, …). Do not hand-roll a frozen literal.
- **Need a tmpdir?** Use `withTmpDir` / `withSandbox` from `src/test-helpers/index.js` rather than `mkdtemp` + `rm` in `beforeEach`/`afterEach`.
- **New ANSI rendering?** Add a golden fixture under `tests/golden/<scenario>/` — the harness in `src/render/render/__golden__.test.ts` picks it up automatically.

The canonical coverage target lives in the colocated tests; `tests/` exists so the slow / broad / fixture-heavy stuff doesn't drag every `vitest --watch` cycle.
