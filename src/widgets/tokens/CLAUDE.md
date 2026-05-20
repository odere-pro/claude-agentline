# CLAUDE.md — `src/widgets/tokens`

> Mid-level map. Group-level boundary rules live in `src/widgets/CLAUDE.md`; the catalogue lives in `src/widgets/families/tokens.ts`.

## Scope

The token widget family. The widgets themselves are defined in `fields.ts` (most via the `defineTokensFieldWidget` factory) and in `speed/`. The remaining folders hold shared helpers used across the family:

- `fields.ts` — the field-style widgets (`tokens`, `tokens-cached`, …). One factory call per `type`.
- `speed/` — the tokens-per-minute widget.
- `format/` — shared number-formatting helpers (k / M, locale-aware).
- `options/` — shared option-shape helpers (reset axis, mode).

## Map

```
src/widgets/tokens/
├── fields.ts   field-style widgets defined via defineTokensFieldWidget factory
│                (tokens, tokens-cached, …)
├── speed/      the tokens-per-minute widget
├── format/     shared number-formatting helpers (k / M, locale-aware)
└── options/    shared option-shape helpers (reset axis, mode)

  Every token widget declares a reset axis from the enum
  (session | block | day | week | model | effort).
  Mixed-axis aggregation refused at schema time (src/data/config/validate/).
```

Patterns: **Pure-function widget** + **Reset-axis tag on accumulators** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/widgets/tokens
```

`tokens-widgets.test.ts` exercises all field widgets and the speed widget against fixture snapshots and a frozen clock.

## Invariants you must not break

- **Reset axis is mandatory and explicit.** Every accumulator widget here declares a `reset` axis (one of `session | block | day | week | model | effort`). Mixed-axis sums are rejected at schema time — never combine axes in a widget render function.
- **Widgets are pure.** Read `ctx.tokens` (frozen snapshot from `src/data/tokens/`); never re-aggregate or re-read the transcript here.
- **Speed reads `ctx.clock`, never wall time.** Goldens stay stable across time zones and CI runners because speed is a function of the injected clock (D-006).
- **Absent snapshot ⇒ hidden cell.** No transcript, no tokens, no model info → hide; never throw.
- **Shared helpers stay pure.** `format/` and `options/` are pure libraries — no I/O, no clock.
- **Catalogue parity.** Every `type` registered here must appear in `src/widgets/families/tokens.ts`.

## Applied patterns

- **Pure-function widget** — keeps goldens byte-stable.
- **Reset-axis tag on accumulators** — the single most load-bearing invariant in this family.

See `docs/cookbook/05-design-patterns.md`.

## How to test this area

- `pnpm exec vitest run src/widgets/tokens` — per-widget output, hidden-cell behaviour, axis-tagged rendering against frozen clock.

## When in doubt

Owning chapter: `docs/cookbook/07-component-specs.md` (§7.1). Snapshot shape and axis semantics: `src/data/tokens/CLAUDE.md` and `docs/GLOSSARY.md`.
