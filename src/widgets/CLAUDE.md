# CLAUDE.md — `src/widgets`

## Scope

The built-in widget set plus the machinery that organises and dispatches it:

- One subdirectory per **widget family** (the named groups defined in `docs/GLOSSARY.md` and `src/widgets/families/catalog-types.ts`); each family folder contains one sub-folder per widget (`<widget>/<widget>.ts` + `<widget>.test.ts`).
- `families/` — the static `WIDGET_CATALOG` metadata. `catalog.ts` aggregates; `families/<family>.ts` (one per family) holds the entries; `catalog-types.ts` carries the shared shapes; `family-factory.ts` + `family-identity.ts` are the single source of truth for a family's glyph + accent.
- `registry/registry.ts` — the runtime `WidgetRegistry` mapping `type` → render function, populated by `registerAllBuiltins()`.
- `types.ts` — the widget contract (`Cell`, `WidgetContext`, `WidgetRender`, `WidgetDef`).
- Standalone widget plumbing in feature folders: `cell/`, `clock/`, `render-widget/`, `separator/`.

Pipeline position: core → data → **widgets** → render → write. Widgets turn frozen snapshots into `Cell`s.

## Map

```
src/widgets/
├── types.ts            widget contract (WidgetRender, WidgetDef)
├── families/           catalogue + identity (single source of truth for widget metadata)
│      └─ catalog.ts, catalog-types.ts, family-factory.ts, family-identity.ts,
│         <family>.ts  (git / tokens / session / rate-limits / context)
├── registry/           runtime type → render lookup, populated by registerAllBuiltins()
├── render-widget/      dispatch wrapper consumed by src/render/
├── cell/, clock/       shared shapes (Cell, ctx.clock)
├── separator/          inter-widget separator
└── <family>/<widget>/  pure (ctx, settings) → Cell — one folder per widget
```

Pattern: **Pure-function widget** + **Registry by string id** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/widgets
```

No golden prerequisite for the unit suites; family suites build an isolated registry rather than the global one.

Widget tests build their `WidgetContext` and snapshots through the shared factories in `src/test-helpers/index.js` (`makeWidgetContext`, `makeGitSnapshot`, `makeTokensSnapshot`, `makeTranscriptEvent`, `makeStdinPayload`, `makeCell`, `frozenClock`). Each accepts `Partial<T>` overrides and returns a frozen object — do not hand-roll an inline `makeSnapshot` / `makeCtx`. File-local thin wrappers are fine when a file needs a specific default (e.g. `prSnapshot` in `git/pr/pr.test.ts`).

## Boundary rules

- Fully **render-reachable** — no `ink`/`react`/`src/tui/` imports (gate-19). `families/family-identity.ts` is deliberately type-only-plus-`unicodeCapable` so it can be shared with the editor preview without dragging the render graph into the cold path.
- **Widget purity is the contract**: a widget is a pure `(context, settings) → Cell`. No async, no I/O, no mutation, and no wall-clock access except `ctx.clock`. A widget that throws or returns malformed output yields a hidden cell — render continues.
- A widget with no data to show returns a hidden cell; it does not error.
- Accumulator widgets declare an explicit `reset` axis; mixed-axis sums are rejected upstream at schema time.
- The **catalogue ↔ registry must stay in parity** — every registered type is catalogued and vice versa; a parity unit test enforces this and a gate checks the README count equals the catalogue count. The catalogue is the single source of truth for the shipped widget set and its size — refer to it; never hardcode a count or an enumerated list here.
- Allowed import direction: `widgets` imports from `core`/`data`; `render` imports from `widgets`, never the reverse.

## Applied patterns

- **Pure-function widget** — determinism, trivial testability, golden-stable.
- **Registry by string id** — config validates `type` against an enum; the registry dispatches, so adding a widget needs no callsite change.
- **Reset-axis tag on accumulators** — surfaces the axis choice and prevents silent footguns.

See `docs/cookbook/05-design-patterns.md`.

## Tradeoffs / non-obvious decisions

- Single binary, widget set fixed at build time — no dynamic widget plugins (D-013).
- Frozen-clock determinism: widgets read time only via `ctx.clock` so goldens stay byte-stable across time zones and CI runners (D-006).

See `docs/cookbook/10-tradeoffs-and-decisions.md`.

## How to test this area

- `pnpm exec vitest run src/widgets` — per-family suites assert each widget's rendered text/colour and its hidden-cell behaviour when its snapshot is absent; the catalog suite asserts catalogue ↔ registry parity and that every entry is frozen and well-formed. Failure mode of the parity test: a widget was registered but not catalogued (or vice versa), which would desync the picker and the README count.
- gate-20 (`gate-20-glossary-check.sh`) — asserts the README widget count equals the catalogue entry count; failure mode is a stale README number.
- gate-19 — guards the render-reachable import boundary.

## When in doubt

Owning chapter: `docs/cookbook/07-component-specs.md` (the widget contract, §7.x) plus `05-design-patterns.md`. Widget terms — "widget", "widget type", "widget family", "variant", "widget catalog", "widget registry" — are defined in `docs/GLOSSARY.md` (authoritative); always say "family" for widget grouping (the older alias is retired — see the glossary). If the docs are silent, open an issue.
