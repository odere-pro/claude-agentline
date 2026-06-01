# CLAUDE.md — `src/data/state`

> Mid-level map. Group-level boundary rules live in `src/data/CLAUDE.md`; this file is the per-cache contract.

## Scope

Six sibling on-disk caches under `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/`:

- `stdin-cache/` — most recent stdin payload; the editor preview reads it when the real transcript is absent.
- `render-cache/` — last-rendered ANSI; debug + preview fallback.
- `backup/` — host-state backup written by `agentline install`; restored byte-for-byte by `agentline uninstall`.
- `version-check-cache/` — latest-version hint refreshed by `update-check`; never consulted on the render hot path as a blocking read.
- `session-plan-cache/` — `session_id` → its latest plan; the `plan` widget's per-session store and a fallback when the transcript is momentarily unreadable. Written best-effort on the live render path under a file lock; only on a real change.
- `claude-health-cache/` — host `claude` CLI health (update-available + `claude doctor` summary) feeding the `claude-update` / `claude-doctor` widgets and doctor D10. Refreshed only by the off-path `claude-health` refresher (the live render spawns it detached when stale); the render path only ever reads it as a synchronous snapshot.

Pipeline position: orthogonal to the render path. Reads are synchronous snapshots; writes go through the atomic helper.

## Map

```
src/data/state/
├── stdin-cache/         most recent stdin payload (read by TUI preview)
├── render-cache/        last-rendered ANSI (debug + preview fallback)
├── backup/              host-state backup for agentline install / uninstall
├── version-check-cache/ latest-version hint (refreshed by update-check)
├── session-plan-cache/  session_id → its latest plan (read by the plan widget)
└── claude-health-cache/ host claude CLI health (read by claude-* widgets + doctor D10)

  All writes: write-temp → fsync → rename via src/core/lib/atomic-write/.
  All reads: synchronous snapshot, exactly once per render tick.
```

Patterns: **Atomic file write** + **Frozen snapshot for I/O resolvers** (`docs/cookbook/05-design-patterns.md`).

## Local setup

```sh
pnpm exec vitest run src/data/state
```

Each cache takes an explicit base-path argument; tests use a tmp dir and never touch the real config dir.

## Invariants you must not break

- **All writes are atomic.** Every cache update goes through `src/core/lib/atomic-write/` (write-temp → `fsync` → `rename`). Never `fs.writeFile` a cache file directly.
- **Reads are best-effort.** A missing or corrupt cache file yields an empty snapshot, never an error. Downstream code already treats absence as the default state.
- **One backup per host-state surface.** `backup/` holds exactly one backup per surface (statusLine, skills) — never accumulating history. Re-backup requires the install command's `--force` flag.
- **Version-check is off the hot path.** `version-check-cache/` is refreshed only by `agentline update-check` (a maintainer concern). The render path may _read_ it as a synchronous snapshot but must never _refresh_ it.
- **Caches are advisory.** Deleting any cache file is safe — the next render rebuilds what it needs from the live snapshot sources.

## Applied patterns

- **Atomic file write** — torn cache files would mislead the editor preview or the uninstall.
- **Frozen snapshot for I/O resolvers** — caches are read once per tick into immutable values.

## Tradeoffs

→ `docs/cookbook/10-tradeoffs-and-decisions.md`

- **D-008** — reversible install with a byte-checksummed backup is what makes touching the host settings file acceptable.

## How to test this area

- `pnpm exec vitest run src/data/state` — atomic round-trip per cache, absence-tolerant reads, backup checksum verify.

## When in doubt

Owning chapter: `docs/cookbook/04-architecture.md` (state surfaces) and `05-design-patterns.md`.
