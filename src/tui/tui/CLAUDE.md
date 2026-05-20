# CLAUDE.md — `src/tui/tui`

> Leaf deep-dive. This is THE cold-path boundary. The single most important fact about this leaf is _how it is reached_, not what it does.

## Scope

This leaf owns the residual editor app shell: the Ink/React entry (`main/main.ts`), the root component (`app.ts`), the input hook + pure handlers (`use/use-editor-input.ts`, `editor/editor-input-handlers.ts`), the editor-binding hook (`use/use-editor-bindings.ts`), the save-flow + terminal-width hooks (`use/use-save-flow.ts`, `use/use-terminal-width.ts`), the footer (`footer.ts`), glyphs (`glyphs/glyphs.ts`), mount lifecycle (`mount.ts`), and persistence (`persist/persist.ts`). The reducer state machine lives in `../state/`, the picker overlays in `../picker/`, and the live preview + data waterfall in `../preview/`.

## Local setup

```sh
pnpm exec vitest run src/tui/tui
```

No golden prerequisite, but `preview-fixture.test.ts`, `preview-model.test.ts`, and `preview-live-parity.test.ts` are the fidelity guards — run them after any preview or colour change. `setPreviewModeForTesting` pins the preview's data source so tests are deterministic without a real transcript.

## Invariants you must not break

- **This is the only place ink/react may be imported.** `gate-19` scans every `.ts` under `src/` _outside_ `src/tui/` for static `ink`/`react`/`./tui/` imports and fails the build on a hit. This leaf is the allowed island.
- **It is reached ONLY via the lazy URL import in `src/cli/cli.ts`.** `runEditor()` does `await import(new URL("./tui.mjs", import.meta.url).href)`. tsup builds `src/tui/tui/main/main.ts` as a _separate_ `dist/tui.mjs` output so Ink + React never enter `cli.mjs`'s parse path. A static `import … from ".../tui/..."` from any render-reachable file would (a) fail `gate-19` and (b) blow the cold-start budget defined in `docs/GLOSSARY.md` (≤ 120 ms p95) by multiples — the import graph dominates process start. The runtime `new URL(...)` is a string, deliberately opaque to the static analyser; keep it that way.
- **State is a pure reducer; the Ink view is thin over it.** `state.ts` imports neither Ink nor React. `reduce(state, action)` is a discriminated-union state machine with two scopes — `edit` and `picker` (the picker has sub-modes `picker-group` / `picker-widget` / `picker-search` / `picker-variant`, but the keymap scope is the two-value flag, see `gate-17`). Picker-only fields live only on the picker branch of the union, so reading them in edit code is a compile error. Do not turn scope into a mutable mode object.
- **No mutation during input handling.** `use-editor-input.ts` and the `handle*Key` functions dispatch reducer actions and set transient React state (`stepQuery`, `stepHighlight`); they never mutate `state`, `state.lines`, or any widget object in place. Editor edits flow action → `reduce` → new immutable state.
- **Preview fidelity is locked by tests and must stay == live.** The preview resolves every widget colour through the same `buildWidgetContext` + `renderWidget` + `resolveColourRgb` path the live statusline uses; `preview-live-parity.test.ts` pins text, resolved `fg`, and hidden state against the live cell. The colour pre-resolution depends on `src/cli/cli.ts` pinning `FORCE_COLOR=3` _before_ the TUI bundle (and its transitive chalk, whose level is fixed at import) loads — so Ink emits the pre-resolved swatch verbatim instead of re-downsampling it. That pin is skipped when colour is disabled (`NO_COLOR` / dumb term) and never overrides a user-set `FORCE_COLOR`. Do not change the `FORCE_COLOR` timing or the parity guard.
- **The preview deliberately diverges from `render` in one way only.** It shows _every_ configured widget on _every_ row at all times (a widget with no data renders as a dim chip, never filtered out) so widgets stay selectable and re-orderable. This is the _only_ sanctioned divergence — colour, text, and hidden resolution must still match the live render exactly.
- **Preview data resolution is a strict synchronous waterfall, recomputed per tick:** cache (stdin cache) → discovered (newest real transcript synthesised into a payload) → mock (representative session, only when no real source exists). All three resolvers are synchronous and TUI-only.
- **Persistence: validate-then-atomic-write, refuse invalid.** `persist.ts` `saveEditedConfig` rebuilds the full `AgentlineConfig` from the editor's line list, runs `validateConfig`, then `writeJsonIdempotent` (write-temp → fsync → rename). A schema-invalid edit blocks the save and surfaces in the footer; a broken config never lands. The SIGTERM handler awaits the in-flight save promise so a kill mid-write does not tear the config.
- **Every keymap action in the active scope is rendered in the footer, and `gate-17` enforces coverage.** Adding or renaming an action means updating the keymap registry; the gate fails if a documented action is missing, malformed, or duplicated.

## Applied patterns

→ `docs/cookbook/05-design-patterns.md`

- **Lazy import (cold path isolation)** — the entire reason this leaf is its own tsup output and reached only by a runtime URL import.
- **Capability flag for editor scopes** — a two-value scope flag plus a registry, not a modal mode object; keeps `gate-17` enforceable.
- **Atomic file write** — the editor save shares the same write-temp + fsync + rename helper as every other persisted artefact.

## Tradeoffs

→ `docs/cookbook/10-tradeoffs-and-decisions.md`

- **D-005** — hot-path / cold-path split: the editor cannot freely share render-path code; widgets are written to be safely importable from both, and the preview pins itself to the render path via tests rather than by importing it carelessly.
- **D-001** — CLI-only, not a host plugin: the editor is a plain TUI verb, not a host-integrated surface.

## How to test this area

- `pnpm exec vitest run src/tui/tui` — `state.test.ts` (reducer transitions, scope narrowing, immutability), `editor-input-handlers.test.ts` (key → action mapping, no in-place mutation), `picker.test.ts` (drill-down, used-type exclusion), `preview-model.test.ts` / `preview-fixture.test.ts` (waterfall + chip layout), `preview-live-parity.test.ts` (preview == live colour/text/hidden — guards the PR-#153 class regression), `persist.test.ts` (validate-before-write, refuse invalid).
- `gate-19-render-no-tui-import.sh` — the boundary that keeps this leaf off the render path.
- `gate-17-keymap-coverage.sh` — every documented editor action is present and well-formed in the compiled keymap registry.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (editor cold path, the hot-path/cold-path boundary), `07-component-specs.md` (TUI editor app: preview-is-a-surface, data resolution, scopes, persistence, failure mode), `05-design-patterns.md`. TUI vocabulary (`editor`, `picker`, `variant`) is defined in `docs/GLOSSARY.md` (authoritative). If the docs are silent, open an issue rather than inventing behaviour.
