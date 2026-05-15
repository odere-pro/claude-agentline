# 03 · Non-functional requirements

> **Intent:** Define budgets, invariants, and quality properties the implementation MUST satisfy independent of stack.
> **Reads-with:** `04-architecture`, `13-testing-strategy`, `17-security-and-compliance`.

Requirement IDs (Nn, On) are stable. Stack-specific numbers (e.g. "120 ms on a 2023 reference host") are illustrative; the reader translates them to their stack's reference machine.

---

## Performance

### N2 — Cold-start budget

The wall-clock time from process start to first byte on stdout MUST be **well under one human-perceivable frame** for a five-widget single-line config when the binary is locally installed. The reference target is the 120 ms class; on slower runtimes (e.g. interpreted languages) the implementer documents the measured number and the workarounds.

### N3 — Steady-state render budget

Once the binary is resident (warm cache, watcher mode), per-render p95 MUST hit the 25 ms class on a 2023-era reference machine. The render path MUST NOT import any TUI framework or interactive-editor module.

### N4 — Memory budget

Resident set during a 24-hour interactive watcher session MUST stay under ~80 MB. The transcript cache and stdin cache between them dominate; both are LRU-bounded.

---

## Determinism and isolation

### N5 — No remote calls

Zero network I/O at render time. Update checks and version polls are gated to their own verbs.

### N6 — No host-state mutation

The render path MUST NOT write to disk, environment variables, or host settings. The published artefact MUST NOT contain absolute paths to the implementer's machine (`/Users/*`, `/home/*`, `~/.claude/*` literals are forbidden — gate 02 enforces).

### N7 — Determinism

Same stdin + same config + frozen wall-clock ⇒ byte-identical bytes on stdout. Non-determinism is confined to time-based widgets (block/weekly timers) and is explicitly tagged at the widget definition site.

### N10 — No ambient state

Every config-derived behaviour MUST be reproducible from the merged config snapshot stored on disk. The binary MAY read host env vars, the host stdin payload, and gitconfig — but only via well-defined adapters; no module reads the env or filesystem implicitly.

---

## Accessibility

### N8 — Degraded modes

Three orthogonal flags MUST produce semantically equivalent output:

- `--no-color` — emits no ANSI colour codes; layout and content unchanged.
- `--no-unicode` — falls back to ASCII glyphs; Powerline chevrons degrade to `>` / `<`.
- `--ascii` — combines both, plus replaces width-aware Unicode characters with ASCII equivalents.

Colour-depth detection downgrades 24-bit → 256-colour → 16-colour automatically based on `COLORTERM` and `TERM`.

---

## Supply chain and dependencies

### N11 — Dependency hygiene

- Runtime dependencies pinned by **exact** version (no caret/tilde ranges).
- Build-time / dev dependencies MAY float within minor.
- The runtime dependency tree is audited on every merge; high-severity advisories block merge.
- No postinstall scripts that touch the host filesystem outside the package's install directory.

### N1 — Implementation language

The implementer picks. The choice MUST satisfy:

- Single-language runtime on Node-class hosts (one runtime install or one static binary).
- Statically typed or with a disciplined typing convention.
- Mainstream packaging story with provenance / signed releases.

---

## Operational budgets

### O1 — Stdin parse budget

≤ 4 ms p95 for a 32 KB stdin payload. Payloads above 256 KB are truncated and a `truncated` marker is emitted on stderr.

### O2 — External command timeout

The custom `command` widget defaults to a 250 ms timeout, per-widget overridable up to 2 000 ms. Timeout renders the widget's `onError` placeholder. The shell is never spawned with user input concatenated into the command line — the widget command is a fixed string from config and is invoked argv-style.

### O3 — Transcript cache

Keyed by `(transcript_path, mtime, size)`. Entries evicted after 5 hours or 32 MB total, whichever first. Per-file reads capped at 16 MB; oversize files render dependent widgets as hidden. `transcript_path` MUST resolve under an allowlisted root (the host's config directory or an env-overridable test root); reads outside that root are refused so a malformed stdin payload cannot become an arbitrary-file-read primitive.

### O4 — Schema migration

When the on-disk schema version is older than the binary's, the binary auto-migrates and writes a `.bak` backup of the prior config. When older binaries encounter a newer schema, they refuse with a structured error (no half-migration).

---

## Self-dogfood

### S1

The implementers MUST install the product on their own machines via the published install path and use it as their statusline. Configuration files used by maintainers are committed under `examples/` so changes that break real usage surface immediately.

---

## Quality envelope summary

| Property           | Envelope                                                                        |
| ------------------ | ------------------------------------------------------------------------------- |
| Cold start         | one frame class (~120 ms reference)                                             |
| Render tick        | quarter-frame class (~25 ms reference)                                          |
| Memory (24 h)      | ≤ 80 MB resident                                                                |
| Network at render  | zero                                                                            |
| Mutation at render | zero                                                                            |
| Determinism        | byte-identical under frozen clock                                               |
| Accessibility      | three degrade modes; auto colour-depth downgrade                                |
| Supply chain       | exact-pinned runtime deps; audited; signed release; no postinstall side-effects |
