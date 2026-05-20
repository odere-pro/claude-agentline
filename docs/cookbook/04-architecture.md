# 04 · Architecture

> **Intent:** Define the system-level shape, the hot-path/cold-path boundary, and the lazy-load discipline that makes the cold-start budget reachable.
> **Reads-with:** `05-design-patterns`, `07-component-specs`, `11-repo-layout`.

## High-level diagram

```text
                    ┌─────────── render hot path ────────────┐
                    │                                         │
host stdin (JSON) ──┼──> parser ──> resolvers ──> widgets ──> compose ──> powerline transform ──> ANSI encoder ──> stdout
                    │                  ▲              ▲
                    │                  │              │
                    │           ┌──────┴──────┐  ┌────┴────┐
                    │           │ config      │  │ theme   │
                    │           │ (layered)   │  │ palette │
                    │           └──────┬──────┘  └─────────┘
                    │                  │
                    │           ┌──────┴────────┐
                    │           │ token / git   │  read-once-per-tick, frozen snapshot
                    │           │ resolvers     │
                    │           └───────────────┘
                    └─────────────────────────────────────────┘

                    ┌─────── editor cold path (rare) ─────────┐
        verb ──────>│  TUI app  ──> reducer ──> atomic write  │──> user config file
                    └─────────────────────────────────────────┘
```

## The hot-path / cold-path boundary

This is the single most load-bearing invariant in the architecture: **the render hot path MUST NOT import any TUI framework or other heavy module.**

- **Render hot path.** Anything reachable from `<bin>` invoked with no args (or `<bin> render`, `<bin> render --fixture`). Synchronous, I/O-frugal, deterministic. Must hit the cold-start budget (`03 · N2`).
- **Editor cold path.** Anything reachable only from `<bin> edit` (and similar interactive verbs). May import the TUI framework, React-style reconciler, debouncer, watcher. Loaded lazily — never imported transitively from the render path.

Enforced by a build/lint gate (`14 · gate-19-render-no-tui-import`). The gate scans the import graph of every render-path entry point and fails if a TUI module appears.

Why so strict? On any interpreted runtime, the import graph dominates cold-start time. A single accidental top-level import of the TUI framework can blow the 120 ms class budget by 5×.

## Render pipeline stages

In order, every tick:

1. **Read stdin** until EOF or the 256 KB cap; reject oversize with a truncation marker.
2. **Parse stdin** as the host statusline JSON contract; preserve unknown fields.
3. **Load and merge config** (defaults → user file → env → flags). Validate the merged result against the schema. Strip reserved JSON meta-keys at every parse boundary (see `05-design-patterns`).
4. **Resolve theme** by name into a palette by role.
5. **Run resolvers once each**: transcript / git. Each produces a frozen snapshot consumed by widgets. Resolvers are the only modules that do I/O on the render path.
6. **Render each widget** by calling `(context, options) → cell`. Widgets are pure.
7. **Compose** cells into one line per `lines[]` entry: apply merge mode, expand flex cells, compute padding, truncate to terminal width.
8. **Powerline transform** when enabled: replace inter-widget separators with chevron pairs; compute adjoining colours.
9. **Detect colour depth** from `COLORTERM` / `TERM`; downgrade ANSI codes accordingly.
10. **Encode ANSI** for each line.
11. **Write stdout** in one syscall, then exit.

Stages 6–11 are pure functions of their inputs; only stage 5 touches the filesystem, and it does so once per tick at most.

## State surfaces

Four on-disk state surfaces are touched by the product. The first three live under a single product state directory; the fourth lives under the host application's config directory (so the host can auto-discover the shipped agent skills). Each is versioned independently of the binary version.

| Surface        | Contents                                                                                                                                                                                                                                                             | Lifecycle                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Stdin cache    | Last full stdin payload, JSON. Written by the render path; the preferred (not sole) source for the TUI live preview, which falls back to transcript discovery, then a mock session, when absent.                                                                     | Overwritten on every real render.                                                                  |
| Render cache   | Last successful stdout bytes.                                                                                                                                                                                                                                        | Overwritten on every successful render.                                                            |
| Config backup  | The user's prior `statusLine` host setting (with checksum) so `uninstall` can restore byte-for-byte.                                                                                                                                                                 | Written by `install`; consumed once by `uninstall`.                                                |
| Shipped skills | The five subagent skill files (`agentline.md`, `agentline-onboarding.md`, `agentline-configure.md`, `agentline-themes.md`, `agentline-troubleshoot.md`) copied into the host's agents directory (e.g. `~/.claude/agents/`) so the host can dispatch to them by name. | Seeded on `install`; removed on `uninstall` only when the bytes still match the shipped originals. |

The first three writes go through the atomic-write helper (`05 · Atomic file write`). The skill-file copy is also byte-faithful (atomic temp + rename) and is byte-match-checked at uninstall so user-edited copies survive a removal cycle (see `16-release-and-versioning · Skill-file lifecycle`).

## Failure model

| Failure                            | Behaviour                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Widget threw / returned malformed  | Cell is hidden. Render continues. No log to stdout (a log line MAY go to stderr). |
| Resolver failed (git / transcript) | All dependent widgets render as hidden. Render continues.                         |
| Stdin malformed                    | One ASCII fallback line on stdout; exit `1`.                                      |
| Config invalid against schema      | Structured error on stderr; exit `2`. Render path emits ASCII fallback on stdout. |
| Schema version newer than binary's | Refuse with a structured error; do not half-migrate. Exit `2`.                    |
| Doctor finding (with `--strict`)   | Exit `3`.                                                                         |
| Unrecoverable internal error       | One ASCII fallback line on stdout; structured error on stderr; exit `1`.          |

Invariant: **stdout always carries at least one line.** The host UI is never blank.

## Caching and live reload

For implementations that support a watcher mode (F15), the architecture adds:

- A debounced fs-watcher over every file in the merged config set.
- A change event invalidates the config / theme resolvers; the next stdin tick re-merges.
- In-flight stdin reads are not dropped; the change applies starting the next tick.

For implementations that prefer one-shot render-and-exit, F15 is satisfied by the host re-invoking the bin on every prompt refresh.

## Concurrency

Within a single render tick, everything is sequential. Resolvers MAY run in parallel if the language's idiom permits, but the cold-start budget is usually tighter than the parallel speedup. Default to sequential; only parallelise after profiling shows benefit.

The watcher mode introduces a second logical thread (the watcher) that coordinates with the render loop through a debounced event channel. No shared mutable state — the watcher signals "reload" and the render loop owns the reload.
