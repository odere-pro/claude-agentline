# CLAUDE.md — `src/core`

## Scope

Foundational, render-reachable primitives with no upward dependencies:

- `lib/` — pure utilities: env access, fs helpers, the atomic-write helper, object/result helpers, Nerd-font / unicode env detection, script resolution.
- `stdin/` — the external→internal contract boundary: read bounded stdin bytes, parse the Claude Code statusline JSON, adapt it to the internal `StdinPayload`.
- `schema/` — the embedded JSON Schema used to validate merged config before anything else touches it.
- `i18n/` — config-driven user-facing string routing (a `Translator` resolved once per render tick).

This is the first link in the pipeline (core → data → widgets → render → write). Everything downstream imports from here; `core` imports from nothing else in `src/`.

## Local setup

```sh
pnpm exec vitest run src/core
```

No fixture or golden prerequisite. Tests are co-located `*.test.ts` files; the determinism injection points (explicit env map, explicit path arguments, no real wall clock) apply here as everywhere.

## Boundary rules

- Fully **render-reachable**. Must stay free of `ink`/`react` and any `src/tui/` import (gate-19 scans this subtree).
- No hidden I/O in `lib/` — utilities are pure; the only sanctioned filesystem write is the atomic-write helper itself, and it is write-temp → fsync → `rename`, never an in-place write.
- `stdin/` is the only place that knows Claude Code's statusline field names; the read step is bounded by a 256 KB cap and over-cap input is flagged `truncated`, never silently grown.
- Allowed import direction: `core` may import only from within `core`. `data`, `widgets`, `render`, `commands`, and `tui` import _from_ `core`, never the reverse.
- Graceful absence: a missing or malformed input produces a structured error or an empty value the caller can fall back on — `core` never throws an unhandled error upward into the render path.

## Applied patterns

- **Schema-first contracts** — the embedded schema validates a parsed boundary payload _before_ any other code reads it.
- **Reserved-meta-key strip at every JSON parse boundary** — `__proto__`/`constructor`/`prototype` are dropped recursively, including inside lenient `additionalProperties` carve-outs.
- **Atomic file write** — the single sanctioned persistence primitive lives in `lib/`.
- **Frozen snapshot for I/O resolvers** — `stdin/` reads the payload exactly once into an immutable shape.

See `docs/cookbook/05-design-patterns.md` for the full rationale; do not duplicate it here.

## Tradeoffs / non-obvious decisions

- Managed-runtime-only, pure-JS, no native modules (D-003).
- The reserved-meta-key strip is applied even where the schema is intentionally lenient (D-010) — cheap, uniform insurance.
- Sandboxed file reads under the host config root keep a hostile `transcript_path` from becoming an arbitrary-file-read primitive (D-009).

See `docs/cookbook/10-tradeoffs-and-decisions.md`.

## How to test this area

- `pnpm exec vitest run src/core` — unit suites for `lib/`, `stdin/`, `schema/`, `i18n/`. Each asserts a single behaviour (bounded read, parse-reject on non-object, atomic rename semantics, reserved-key strip, translator fallback to English).
- gate-19 (`tests/gates/gate-19-render-no-tui-import.sh`) — guards against a stray `ink`/`react`/`src/tui/` import sneaking into this render-reachable subtree; failure mode is a blown cold-start budget.
- gate-11 (`gate-11-schema-roundtrip.sh`) — the exported schema validates against itself and against the shipped config template; failure mode is a schema/template drift.

## When in doubt

The owning chapters are `docs/cookbook/04-architecture.md` (pipeline stages, failure model) and `05-design-patterns.md`. Vocabulary is governed by `docs/GLOSSARY.md` (authoritative). If the docs are silent, open an issue rather than inventing behaviour.
