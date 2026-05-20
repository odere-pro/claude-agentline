# CLAUDE.md — `src/render/render`

> Leaf deep-dive. This is the render hot path. Treat every rule here as load-bearing — a regression here is observable on every Claude Code prompt.

## Scope

This leaf owns the deterministic transform from a parsed stdin payload + resolved config/theme/snapshots into the exact ANSI bytes written to stdout. Concretely: the pipeline (`pipeline.ts`), widget-context assembly (`context.ts`, `inputs.ts`), composition / flex / truncation (`compose.ts`), width math (`width.ts`), colour-depth detection (`colour-depth.ts`), accessibility downsample (`accessibility.ts`), the ANSI encoder (`ansi.ts`), the segment type (`segment.ts`), the one-syscall writer (`write.ts`), the in-process fixture replay (`fixture-runner.ts`, `fixture-command.ts`), and the source-side golden harness (`__golden__.test.ts`).

## Local setup

```sh
pnpm exec vitest run src/render/render
```

Fixtures/goldens it needs: scenario dirs under `tests/golden/<scenario>/` each with `stdin.json`, `config.json`, `clock.txt`, `expected.ansi`. The harness in `__golden__.test.ts` walks them, runs `renderForFixture` with env pinned to `{ NO_COLOR: "1", AGENTLINE_GLYPHS: "ascii" }`, `width: 80`, and asserts byte-equality against `expected.ansi`.

## Invariants you must not break

- **Determinism contract: same inputs ⇒ byte-identical output.** Every stage from widget render onward is a pure function of its inputs. No wall-clock except via the injected `Clock` (`frozenClock` in goldens). No env read outside the explicit `env` snapshot. No filesystem access in this leaf — snapshots arrive as `RenderInputs`; producers wire loaders elsewhere. The golden harness is what locks this; a non-deterministic change shows up as a golden diff.
- **The golden update workflow.** An `expected.*` file is regenerated _only_ when the output change is intentional and understood. Procedure: make the change, run the harness, read the diff, confirm it is exactly the intended delta and nothing else, then re-record and commit the snapshot in the same change with a note explaining why. An unexpected or unexplained diff is a bug to investigate — never blindly re-record to make the suite green. Goldens are pinned to ASCII glyphs and `NO_COLOR` so they stay reproducible without a Nerd Font or a colour terminal.
- **Order: detect colour depth → apply accessibility → encode.** `effectiveDepth(detectColourDepth(...), flags)` collapses to `"none"` when `noColor` is set; `--no-color` / non-empty `NO_COLOR` always win (`honourNoColorEnv`). `applyAccessibility` strips non-ASCII to its fallback table when `noUnicode`. Downsample is perceptual nearest-match (truecolor → 256 cube → 16-colour table) inside `ansi.ts`; do not reorder these stages.
- **Width math is grapheme-aware and never splits an escape.** Composition measures East-Asian wide, emoji, and ZWJ sequences via `width.ts`; truncation/ellipsis must land on a cell boundary and never inside an ANSI escape sequence. When no real width signal exists (`detected: false`), the pipeline composes against `NO_WRAP_WIDTH` with `noWrap: true` — one row per configured line, host clips horizontally — rather than wrapping a guessed 80. Do not apply `full-minus-40` to a guessed width.
- **Exactly one stdout syscall per render.** The whole frame is accumulated into one buffer and emitted by `writeOnce` in `write.ts` (single `stream.write`, trailing newline appended once). No incremental writes — interleaving produces torn lines in the host UI.
- **stdout always carries at least one line.** Even on a wholly broken config the render emits an ASCII fallback line; the host statusline is never blank.
- **Latency + cold-start budgets are defined in `docs/GLOSSARY.md` — cite verbatim, never invent.** The render path must complete in ≤ 25 ms p95 (`render path`). Cold start (process-start to first byte) must be ≤ 120 ms p95 (`cold start`). If you need a number, read it from `docs/GLOSSARY.md`; do not write a different figure anywhere in code or comments.
- **No ink/react/TUI import — enforced by `gate-19`.** Every `.ts` under `src/` outside `src/tui/` is scanned for static imports of `ink`, `react`, or any `./tui/` / `../tui/` path. A single accidental top-level TUI import here blows the cold-start budget by multiples. The only legitimate TUI entry is the runtime URL import in `src/cli/cli.ts` (a string, not a static import).
- **No network at render time.** This leaf makes no outbound requests, ever (`gate-14`).
- **Failure model is hide-and-continue.** A widget that throws or returns malformed yields a hidden cell; a missing snapshot hides dependent widgets. Render continues; diagnostics go to stderr (deduped), never to stdout.

## Applied patterns

→ `docs/cookbook/05-design-patterns.md`

- **Pure-function widget** — referential transparency is what makes goldens byte-stable.
- **Frozen snapshot for I/O resolvers** — snapshots arrive as inputs; this leaf never re-reads.
- **Lazy import (cold path isolation)** — this leaf is the protected side of the boundary `gate-19` enforces.

## Tradeoffs

→ `docs/cookbook/10-tradeoffs-and-decisions.md`

- **D-005** — hot-path / cold-path split: the cold-start budget is dominated by the import graph; this leaf must stay tiny.
- **D-006** — frozen-clock determinism: a single injected clock handle keeps goldens stable across time zones and CI runners.
- **D-003** — managed-runtime-only: some perf on pathological inputs is given up for zero-build install.

## How to test this area

- `pnpm exec vitest run src/render/render` — `__golden__.test.ts` asserts byte-identical output per scenario (guards: any silent output drift); `compose*.test.ts` / `width.test.ts` (flex expansion, grapheme-aware truncation never inside an escape); `ansi.test.ts` (depth downsample correctness); `accessibility.test.ts` (`NO_COLOR` / `--no-unicode` collapse); `colour-depth.test.ts` (`COLORTERM`/`TERM` detection); `write.test.ts` (single-write, trailing newline).
- `gate-19-render-no-tui-import.sh` — fails the build if any render-reachable source statically imports ink/react/`src/tui/`.
- `gate-13-cold-start-budget.sh` — benches process-start-to-first-byte against the `docs/GLOSSARY.md` budget (informational on CI, strict at tag time).
- `gate-14-no-network-render.sh` — guards "no network at render time".
- `gate-16-accessibility-fallbacks.sh` — guards the no-colour / no-unicode fallbacks.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (the hot-path/cold-path boundary, render pipeline stages, failure model), `07-component-specs.md` (composer, encoder, detector contracts), `05-design-patterns.md`. Budgets and render vocabulary are defined in `docs/GLOSSARY.md` (authoritative). If the docs are silent, open an issue rather than inventing behaviour.
