# CLAUDE.md — `src/data/tokens`

> Mid-level map. Group-level boundary rules live in `src/data/CLAUDE.md`; this file is the per-stage map for the token snapshot.

## Scope

The four sibling stages that turn a transcript file into the frozen token / context-window / speed snapshots widgets consume:

- `transcript/` — bounded read of the transcript path from stdin, parsed into typed events.
- `aggregate/` — pure summation of token counts, applying the **reset axis** declared on each accumulator.
- `context-window/` — derived view: current context-window occupancy.
- `speed/` — derived view: tokens-per-minute, model-aware.

Pipeline position: core → **data/tokens** → widgets/tokens → render. One read per render tick; the result is frozen for the rest of the tick.

## Map

```
stdin transcript path ──▶ transcript/   (read once, parse, frozen snapshot)
                                │
                                ▼
                          aggregate/    (sum tokens, apply reset axis tag)
                                │
                       ┌────────┴────────┐
                       ▼                 ▼
                context-window/         speed/
               (current ctx window)   (tokens/min, model-aware)

  Reset axes (one per accumulator): session | block | day | week | model | effort
  Mixed-axis aggregation refused at schema time (src/data/config/validate/).
```

Patterns: **Frozen snapshot for I/O resolvers** + **Reset-axis tag on accumulators** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/data/tokens
```

Tests use synthetic transcript fixtures — no real host transcript access. All resolvers take an explicit `env` argument; they do not read the real filesystem or wall clock.

## Invariants you must not break

- **Synchronous snapshot, one read per tick.** `transcript/` reads bounded bytes once per render tick into a frozen value. Downstream stages (`aggregate/`, `context-window/`, `speed/`) are pure transforms of that snapshot — no re-reads, no I/O.
- **Reset-axis tag is mandatory on every accumulator.** Every widget that surfaces a token total declares its `reset` axis (one of `session | block | day | week | model | effort`). The schema rejects mixed-axis sums at validate time. Never sum across axes here.
- **Absent transcript → empty snapshot, not an error.** Missing or unreadable transcript yields a snapshot whose accumulators are empty. The dependent widget hides; render continues.
- **No outbound network, no child process** — token data comes from the local transcript file only.
- **Sandboxed reads.** The transcript path is sandboxed under the host config root (D-009); a hostile path must not become an arbitrary-file-read primitive.

## Applied patterns

- **Frozen snapshot for I/O resolvers** — the transcript is read once into an immutable shape.
- **Reset-axis tag on accumulators** — the single most load-bearing invariant in this leaf.

See `docs/cookbook/05-design-patterns.md`.

## Tradeoffs

→ `docs/cookbook/10-tradeoffs-and-decisions.md`

- **D-006** — frozen-clock determinism: speed is a function of the injected `Clock`, not wall time, so goldens stay stable.
- **D-009** — sandboxed file reads under the host config root.

## How to test this area

- `pnpm exec vitest run src/data/tokens` — per-stage suites: bounded transcript read, axis-tagged aggregation, context-window derivation, speed calculation against a frozen clock.
- gate-19 (render-no-tui) — guards the render-reachable import boundary.

## When in doubt

Owning chapter: `docs/cookbook/06-data-contracts.md` (snapshot shape) and `05-design-patterns.md`. Reset-axis vocabulary is authoritative in `docs/GLOSSARY.md`.
