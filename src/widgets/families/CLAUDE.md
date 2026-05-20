# CLAUDE.md — `src/widgets/families`

> Mid-level map. Group-level boundary rules live in `src/widgets/CLAUDE.md`; this file is the catalogue contract.

## Scope

The single source of truth for widget metadata: every shipped widget's `type`, family, name, description, and variants.

- `catalog.ts` — the aggregated `WIDGET_CATALOG`.
- `catalog-types.ts` — the `Catalogue` / `WidgetCatalogEntry` shapes.
- `family-factory.ts` — builds a family entry from a partial spec.
- `family-identity.ts` — the one map per family → glyph + accent colour. Deliberately type-only-plus-`unicodeCapable` so the editor preview can share it without dragging the render graph into the cold path.
- `<family>.ts` — per-family catalogue entries: `git.ts`, `tokens.ts`, `session.ts`, `rate-limits.ts`, `context.ts`.

Pipeline position: render-reachable. Read by `src/widgets/registry/` to dispatch and by `src/tui/picker/` to populate the picker.

## Map

```
src/widgets/families/
├── catalog.ts           the WIDGET_CATALOG (single source of truth)
├── catalog-types.ts     the Catalogue / WidgetCatalogEntry types
├── family-factory.ts    builds a family entry from a partial spec
├── family-identity.ts   one map per family → glyph + accent (type-only-plus-unicodeCapable)
└── <family>.ts          per-family entries: git, tokens, session, rate-limits, context

  Catalogue ↔ registry parity is enforced by catalog.test.ts and gate-20.
  Every widget.<type>.name / .desc / .variant.<id> authored here
  (dictionary contract — gate-26).
```

Pattern: **Registry by string id** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/widgets/families
```

## Invariants you must not break

- **Catalogue ↔ registry parity.** Every `type` registered in `src/widgets/registry/` must appear in `WIDGET_CATALOG` and vice versa. `catalog.test.ts` asserts both directions; a divergence desyncs the picker and the README count.
- **The catalogue authors every catalogue-driven dictionary string.** `widget.<type>.name`, `widget.<type>.desc`, and `widget.<type>.variant.<id>` are authored here (or referenced from `<family>.ts`). gate-26 fails the build if a literal id used at a translator call site does not resolve here.
- **Family identity is one map.** A family has exactly one glyph + accent colour, set in `family-identity.ts`. Do not introduce per-widget overrides.
- **Frozen entries.** Catalogue entries are constructed once and never mutated. `family-factory.ts` returns a frozen object; consumers may only read.
- **No data fetching here.** The catalogue is static metadata. Snapshot resolvers live under `src/data/`; rendering lives under `src/widgets/<family>/<widget>/`.
- **Render-reachable.** No `ink`/`react`/`src/tui/` imports (gate-19). `family-identity.ts` is kept lean so the editor preview can re-use it without pulling render-only modules.

## Applied patterns

- **Registry by string id** — the config validates `type` against the catalogue enum; the registry dispatches; the picker enumerates.

See `docs/cookbook/05-design-patterns.md`.

## How to test this area

- `pnpm exec vitest run src/widgets/families` — catalogue ↔ registry parity, frozen-ness, well-formed entries, family-identity completeness.
- gate-20 (`gate-20-glossary-check.sh`) — README widget count equals the catalogue entry count.
- gate-26 (`gate-26-i18n-id-namespace.sh`) — every catalogue-driven dictionary id is well-formed and matches the English source.

## When in doubt

Owning chapter: `docs/cookbook/07-component-specs.md` (widget contract, §7.1) and `05-design-patterns.md`. Vocabulary in `docs/GLOSSARY.md` (authoritative).
