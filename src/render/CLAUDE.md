# CLAUDE.md — `src/render`

## Scope

The terminal end of the hot path:

- `render/` — the pipeline (`pipeline.ts`), composition (merge mode, flex expansion, padding, width-aware truncation), colour-depth detection, accessibility downsampling, the ANSI encoder, the segment model, the one-syscall stdout writer, and the `render --fixture` ops/debug command.
- `powerline/` — the optional render-only post-compose transform that swaps inter-widget separators for chevron pairs and computes adjoining colours.

Pipeline position: core → data → widgets → **render** → write. This group owns stages "compose" through "write stdout, then exit".

## Local setup

```sh
pnpm exec vitest run src/render
```

The golden suite (`render/__golden__.test.ts`) reads scenarios under `tests/golden/<scenario>/` (`stdin.json`, `config.json`, `clock.txt`, `expected.ansi`). Intentional output changes require re-recording the affected golden plus a changelog fragment in the same PR.

## Boundary rules

- Fully **render-reachable** — no `ink`/`react`/`src/tui/` imports. gate-19 scans every render-path source and fails on a forbidden static import; this is the single most load-bearing invariant in the architecture.
- **Determinism**: identical inputs must produce byte-identical ANSI. Composition and encoding are pure functions of their inputs; no clock, no I/O.
- Colour-depth detection then accessibility downsample run in a fixed order so the same input maps to the same downgraded codes.
- Width math is East-Asian / emoji aware; truncation never splits an ANSI escape sequence and the OSC-8 href is excluded from the visible-width calculation.
- Output is written in **one syscall**, then the process exits; stdout always carries at least one line (the host UI is never blank).
- Powerline is a **render-only post-compose transform** — it runs after composition, never feeds back into a widget.
- The render-path latency budget and the cold-start budget are stated in `docs/GLOSSARY.md` (see "render path" and "cold start"); cite that file verbatim — do not invent a number here.
- Allowed import direction: `render` imports from `core`/`data`/`widgets`; nothing in the render path imports `tui`.

## Applied patterns

- **Pure-function widget** consumers downstream — composition/encoding stay referentially transparent so goldens are byte-stable.
- **Lazy import (cold path isolation)** — by staying ink/react-free this group keeps the import graph (and thus cold start) tiny.

See `docs/cookbook/05-design-patterns.md`.

## Tradeoffs / non-obvious decisions

- Hot-path / cold-path split: code sharing with the editor is given up so an accidental TUI import cannot blow the cold-start budget (D-005).
- Frozen-clock determinism for tests (D-006) — the renderer is asserted byte-exact rather than via terminal behaviour.
- Managed-runtime-only: some perf on pathological inputs is traded for a zero-build install (D-003).

See `docs/cookbook/10-tradeoffs-and-decisions.md`.

## How to test this area

- `pnpm exec vitest run src/render` — composition/overflow, width math, colour-depth, accessibility, segment/ANSI encoding, one-syscall write, and the golden byte-exact suite. Failure mode of the golden suite: any unintended output change is a regression — investigate, do not blindly re-record.
- gate-12 (`render determinism`) — replays every `tests/golden/` scenario through `render --fixture` and diffs against `expected.ansi`.
- gate-16 (`accessibility fallbacks`) — `--no-color` / `--no-unicode` / `--ascii` produce the expected character classes and flag-specific golden.
- gate-19 — locks down the no-TUI-import invariant; failure means the cold-start budget is at risk.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (pipeline stages, hot/cold boundary) and `13-testing-strategy.md` (golden fixture format, how to update intentionally). Latency/cold-start numbers are authoritative in `docs/GLOSSARY.md`. If the docs are silent, open an issue rather than inventing behaviour.
