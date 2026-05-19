# CLAUDE.md — `src/data`

## Scope

The resolver and on-disk-state layer that sits between `core` and `widgets`:

- `config/` — layered config load/merge/validate, the env-override decoder, and the scriptable `config widget` mutation verbs.
- `theme/` — theme load, palette resolution by role, colour parsing.
- `tokens/` — transcript-derived token / context-window / speed snapshots and the reset-axis type.
- `git/` — git working-tree snapshot (invoke + parse), optional PR lookup.
- `session/` — identity fields resolved from stdin with auth-file and plan-discovery fallback.
- `state/` — on-disk caches (stdin cache, render cache, install backup, version-check cache).

Pipeline position: core → **data** → widgets → render → write. `data` produces the frozen snapshots widgets consume.

## Local setup

```sh
pnpm exec vitest run src/data
```

No golden prerequisite. Readers accept explicit path/env arguments so tests never touch the real filesystem layout or the real clock.

## Boundary rules

- Fully **render-reachable** — no `ink`/`react`/`src/tui/` imports (gate-19).
- Resolvers are **synchronous snapshot producers**: each I/O-bound resource is read **exactly once per render tick** into an immutable snapshot; nothing here blocks or re-reads mid-tick.
- Absent data → the dependent widget _hides_; it is not an error and never propagates upward.
- `state/` writes go through the `core` atomic-write helper (write-temp → fsync → `rename`); never an in-place write.
- Config layering order is defaults → user file → env override → flags, **validate-before-merge** at each layer; there is no per-project layer.
- Reset axes are explicit (`session` / `block` / `day` / `week` / `model` / `effort`). Mixed-axis aggregation is forbidden and rejected at schema time.
- Allowed import direction: `data` imports from `core` only; `widgets`/`render`/`commands`/`tui` import from `data`, never the reverse.

## Applied patterns

- **Frozen snapshot for I/O resolvers** — transcript/git/session read once into an immutable snapshot widgets only query.
- **Layered immutable config merge** — each layer is parsed, stripped, and validated before the next merges in.
- **Registry by string id** — themes are looked up by their string id; the schema validates the id, the resolver dispatches.
- **Reset-axis tag on accumulators** — every accumulator carries its `reset` axis; cross-axis sums are refused.

See `docs/cookbook/05-design-patterns.md`.

## Tradeoffs / non-obvious decisions

- No per-project config layer — a single source of truth, even though per-repo theming is given up (D-004).
- Schema-versioned config with forward/backward migration; a newer schema is refused, not half-migrated (D-007).
- Sandboxed reads under the host config root (D-009).

See `docs/cookbook/10-tradeoffs-and-decisions.md`.

## How to test this area

- `pnpm exec vitest run src/data` — per-module suites: config merge precedence, env-override decoding, schema validation rejecting cross-axis sums, theme role resolution + fallbacks, snapshot resolvers returning an absent/hidden marker rather than throwing, atomic-cache round-trips.
- gate-11 (`gate-11-schema-roundtrip.sh`) — config template validates against the schema; failure mode is template/schema drift.
- gate-19 — guards the render-reachable import boundary.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (state surfaces, failure model), `06-data-contracts.md`, `05-design-patterns.md`. The widget set and its reset-axis vocabulary are defined in the widget catalogue and `docs/GLOSSARY.md` (authoritative) — refer to those, do not restate them. If the docs are silent, open an issue.
