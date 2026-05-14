# Tests

`agentline` keeps its unit tests **colocated** with the source they exercise: each `src/**/foo.ts` has a sibling `src/**/foo.test.ts`. Vitest discovers them automatically. This directory holds the slower, broader tests that don't fit alongside a single module.

## Layout

| Path                | Purpose                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tests/integration` | End-to-end CLI flows that spawn `dist/cli.mjs` (install / uninstall, etc.). Slower; require `npm run build` first.   |
| `tests/tui`         | TUI editor smoke tests that drive Ink against a captured stdin stream.                                               |
| `tests/widgets`     | Cross-widget invariants (registry parity, context module shape) — checks that no individual widget test would catch. |
| `tests/golden`      | Byte-equality fixtures for rendered ANSI output. See `tests/golden/README.md`.                                       |
| `tests/gates`       | Shell gates run from CI via `bash tests/gates/run-all.sh`. Not vitest — exit 0 / 1 / 2.                              |

## Running

```bash
npm test                       # full vitest suite (colocated + tests/)
npx vitest run src/widgets     # subset
bash tests/gates/run-all.sh    # gate suite (offline-friendly; tools auto-skip when absent)
```

## Adding a test

- New module under `src/`? Add `foo.test.ts` next to `foo.ts`. That is the canonical surface.
- New cross-module invariant? Add under `tests/<area>/`.
- New ANSI rendering? Add a golden fixture under `tests/golden/<scenario>/` and wire it into `tests/widgets/`.

The canonical coverage target lives in the colocated tests; `tests/` exists so the slow / broad / fixture-heavy stuff doesn't drag every `vitest --watch` cycle.
