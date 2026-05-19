# CLAUDE.md — `src/tui`

## Scope

The interactive editor — **the cold path**:

- `tui/` — the Ink app, the reducer-style state machine (`state*.ts`), the widget picker, the live preview (fixture / discovery / mock sources), the footer, persistence, and the editor input handlers.
- `keys/` — the keymap registry (`DEFAULT_KEY_BINDINGS`) and the scope/binding types.

Pipeline position: this group is **not** in the render hot path (core → data → widgets → render → write). It is reachable only from `agentline edit`.

## Local setup

```sh
pnpm exec vitest run src/tui
```

`src/tui/**/*.test.ts` may import `ink`/`react` via the testing library — gate-19 excludes the entire `src/tui/` subtree for exactly this reason. The preview suites need the demo fixture; preview-fidelity is locked by `preview-live-parity.test.ts`.

## Boundary rules

- This is **the** cold-path boundary: only `src/tui/` may import `ink`/`react`. No render-reachable module may import anything under `src/tui/`.
- The editor is loaded solely via the lazy runtime URL import `new URL("./tui.mjs", …)` in `src/cli.ts` — a deliberate runtime string, not a static import, so the analyser never resolves it against the render tree. Keeping it lazy is what makes gate-19 and the cold-start budget hold; do not add a static `import` of this group anywhere render-reachable.
- State is a **reducer-style state machine** — actions in, new immutable state out; no in-component mutation.
- Editor scope is a small flag (`edit` / `picker`), not a mode object with sub-state.
- Preview fidelity is contractually locked by tests: the preview must paint what the live render bin would print at the detected colour depth.
- `keys/` is its own tsup entry (`dist/keys.mjs`), consumed by the keymap-coverage gate; keep `DEFAULT_KEY_BINDINGS` exportable from there.
- Allowed import direction: `tui` may import from `core`/`data`/`widgets`/`render`; nothing imports back into `tui`.

## Applied patterns

- **Lazy import (cold path isolation)** — the entire group is behind one lazy URL import so its weight never reaches cold start.
- **Capability flag for editor scopes** — a two-value scope plus a registry keeps the editor surface small and the keymap gate enforceable.
- **Atomic file write** — editor save persists the user config via the `core` write-temp → fsync → `rename` helper.

See `docs/cookbook/05-design-patterns.md`.

## Tradeoffs / non-obvious decisions

- Hot-path / cold-path split (D-005): the editor cannot freely import render-path code; the chosen mitigation is render-safe widget modules plus a preview adapter.
- Flat CLI surface — `edit` is one top-level verb, not a nested dispatcher (D-011).
- Frozen-clock determinism keeps the preview parity assertion stable (D-006).

See `docs/cookbook/10-tradeoffs-and-decisions.md`.

## How to test this area

- `pnpm exec vitest run src/tui` — state-machine reducers, picker navigation/filter, preview model + discovery + live-parity, input handlers, persistence. Failure mode of the parity suite: the preview drifted from the live render and would mislead the user.
- gate-17 (`keymap coverage`) — every documented action is present in `dist/keys.mjs`, every binding has the required fields, action ids are unique. Failure mode: an undocumented or missing binding.
- gate-13 (`cold-start budget`) and gate-19 depend on this group staying behind the lazy import — a static import here breaking out is what they catch.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (cold-path boundary), `05-design-patterns.md`, and the keymap doc that gate-17 cross-checks. TUI terms ("editor", "picker") are defined in `docs/GLOSSARY.md` (authoritative); "options sheet" is a retired term — do not reintroduce it. If the docs are silent, open an issue.
