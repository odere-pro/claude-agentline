# CLAUDE.md — `src/commands`

## Scope

The non-render verbs and host-wiring lifecycle:

- `install/` — wire the `statusLine` host setting and copy skill files, with a paired byte-checksummed backup.
- `uninstall/` — reverse the install and restore the prior host setting byte-for-byte.
- `reset/` — the user/agent-facing entry point: install steps plus a forced config reseed.
- `doctor/` — diagnose host wiring, with `--fix` repair and a `--json` report.
- `update-check/` — an out-of-render-path helper that refreshes a cached latest-version hint; **not** a user-facing command.

The CLI dispatch entry lives at `src/cli/cli.ts`; per-subcommand help utilities are in `src/core/lib/help/help.ts` so the data-layer config verbs can consume them without crossing the "data imports from core only" boundary.

Pipeline position: orthogonal to the render path (core → data → widgets → render → write). These verbs run only when explicitly invoked.

## Local setup

```sh
pnpm exec vitest run src/commands
```

Install/uninstall round-trip behaviour is also exercised by the slow integration test on a disposable host config dir; run that before opening a PR that touches wiring.

## Boundary rules

- Render-reachable in the sense that `src/cli/cli.ts` imports the arg-parsers/dispatchers at the top — so this group must stay `ink`/`react`/`src/tui/`-free (gate-19). Only `agentline edit` pulls the TUI, via the lazy URL import.
- Every host-file mutation `install` makes is paired with a backup capturing the prior value plus a checksum; `uninstall` restores byte-for-byte and verifies the checksum.
- All persisted writes (backup, reseeded config) go through the `core` atomic-write helper — write-temp → fsync → `rename`.
- Host wiring is **idempotent**: a second install is a no-op / already-installed; there is one backup per host-state surface, never accumulating history.
- Destructive reseed (`reset` overwriting a user-edited config) is gated behind `--force`; without it, user-authored content is preserved.
- `update-check/` never runs on the render path and never blocks it; it is a maintainer/cache concern, not a command.
- Allowed import direction: `commands` imports from `core`/`data`/`render`; it does not import `tui` (the editor verb dispatches through the lazy URL in `src/cli/cli.ts`).

## Applied patterns

- **Reversible host-state mutation** — every install change has a checksummed backup; uninstall restores byte-for-byte.
- **One backup per host-state surface** — installs never pile up backup history; re-backup needs `--force`.
- **Atomic file write** — backups and the reseeded config are written atomically.

See `docs/cookbook/05-design-patterns.md`.

## Tradeoffs / non-obvious decisions

- CLI-only, not a host plugin — uses the stable `statusLine` + stdin contract (D-001).
- Reversible install with a byte-checksummed backup — the trust mechanism that makes touching the host settings file acceptable (D-008).
- Flat CLI surface, no nested dispatchers — shorter cold-start path, one-view `--help` (D-011).

See `docs/cookbook/10-tradeoffs-and-decisions.md`.

## How to test this area

- `pnpm exec vitest run src/commands` — install/uninstall round-trip and idempotency, backup checksum verify, doctor checks/fix/format, reset reseed-vs-preserve behaviour, update-check fetch/refresh caching.
- gate-01 (`doctor`) — `agentline doctor` exits `0` on a freshly bootstrapped host; failure mode is missing host wiring.
- gates 07–10 (install round-trip, content preservation, idempotency, `--dry-run` parity) — failure mode is a non-reversible or non-idempotent host mutation.
- gate-19 — keeps this dispatched-at-top group ink/react-free.

## When in doubt

Owning chapters: `docs/cookbook/04-architecture.md` (state surfaces, failure model) and `05-design-patterns.md`. Command and config surface terms are defined in `docs/GLOSSARY.md` (authoritative) — note `agentline init` and `agentline config theme` are retired; do not reintroduce them. If the docs are silent, open an issue rather than inventing behaviour.
