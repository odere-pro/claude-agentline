# Agentline Architecture

## High-Level Design

Agentline is a **stateless render tool** that reads a JSON stdin contract, renders a statusline string, and writes it to stdout. The architecture enforces a critical separation: the **render hot path** (process startup to stdout write) must never import UI libraries.

```
stdin (JSON) → parser → widgets → renderer → stdout (ANSI)
                          ↓
                       theme
                       config
                       tokens (transcript)
```

## Render Hot Path (§1, §8)

The render path is synchronous, I/O-free, and deterministic:

1. **Parse stdin** (`src/stdin/`) — 256 KB cap, guard against malformed JSON
2. **Load config** (`src/config/`) — merge defaults + user file + env vars
3. **Load theme** (`src/theme/`) — validate against schema, downgrade colour depth
4. **Load tokens snapshot** (`src/tokens/`) — read transcript once, cache globally
5. **Render widgets** (`src/widgets/`) — each widget is a pure function
6. **Compose line** (`src/render/compose.ts`) — layout flex-separators
7. **Powerline transform** (`src/powerline/`) — insert chevrons, adjust colours
8. **Encode ANSI** (`src/render/ansi.ts`) — apply colour depth downgrade
9. **Write stdout** — one atomic write, never torn

**Invariant**: No imports of `ink` or `react` above `src/tui/`. Enforced by `tests/gates/gate-14-no-network-render.sh`.

## Optional TUI Layer (`src/tui/`)

When invoked as `agentline config` (edit mode), the TUI loads `ink` and React to provide an interactive editor. The TUI is **optional** and completely isolated from the render path.

```
agentline config → TUI (Ink + React) → config mutation → file write
```

The TUI reads the existing config, mutates it via reducer, and persists via atomic write (same path as render-time `config/atomic.ts`).

## Widget System (§7)

Every widget is a pure function:

```typescript
type WidgetRender = (ctx: WidgetContext, settings: WidgetSettings) => Cell;
```

- **Input**: context (stdin, config, theme, clock, env snapshot) + user options
- **Output**: styled text cell (or hidden when data is absent)
- **Invariants**:
  - Synchronous (no async, no Promise)
  - No filesystem access (reads happen in render-tick setup, not in widget)
  - No wall-clock time (uses `ctx.clock.now()` for determinism)
  - No mutation of input or shared state

The registry holds built-in implementations; tests can inject isolated instances via `resetDefaultRegistry()` (test-only seam).

## Config System

Configuration is **layered, global-only, and immutable**:

1. Built-in defaults (`src/config/defaults.ts`)
2. User file at `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/config.json`
   — the single source of truth (§13: no project layer; any
   `.agentline.json` in cwd is silently ignored)
3. Environment variables (`AGENTLINE_*`)
4. CLI flags (`--theme`, `--width`, etc.)

Each layer is validated against the JSON Schema before merge. Writes go through atomic file operations (write-temp + fsync + rename). See [`docs/install.md`](./install.md#how-agentline-syncs-with-claude-code) for the end-to-end stdin → render → stdout chain.

## Token/Transcript System (`src/tokens/`)

The transcript is the Claude Code session's token ledger: a JSONL file containing:

- Each API call (request metadata, token counts)
- Session boundaries
- Model switches
- Block resets

The render-tick resolver reads the file once and caches it (`process-wide, LRU, 32 MB max`). Widgets query the frozen snapshot; no refetches during render.

Reset axes (session, block, day, week, model, effort) are enforced: a widget cannot mix axes in a single aggregation.

## Git System (`src/git/`)

Similar to tokens, the render-tick resolver runs `git` once and caches the result. Widgets query the frozen snapshot.

## Doctor System (`src/doctor/`)

Verification checks (D01–D10) run sequentially and report health status. `--fix` repairs the four safe mutations (settings scaffold, statusLine wiring, config defaults, theme copy). Refusing unsafe mutations (`--force` required for foreign statusLines).

## Type Safety

The codebase is **fully typed** (TypeScript strict mode, zero `any`). Public APIs are explicitly typed; internal implementations leverage inference.

No `@ts-ignore` or `@ts-nocheck` anywhere. Type errors block commit.

## Testing Strategy

- **88 unit tests** — focused on individual modules (widgets, config, tokens, render)
- **1 integration test** — `tests/integration/install.test.ts` covers the install/uninstall lifecycle
- **13 repo gates** — markdown, shellcheck, schema round-trip, accessibility fallbacks, cold-start budget, platform matrix, changelog presence

Unit tests use frozen clocks and fixtures for determinism. Integration tests touch real disk/files and are expected to be slower.

## Performance Budgets

- **Cold start (p95)**: ≤ 120 ms (measured via `tests/gates/gate-13-cold-start-budget.sh`)
- **Render output**: Deterministic byte-for-byte match (golden tests, `tests/golden/`)
- **Installed footprint**: ~50 MB (npm tarball + deps)

## Error Handling

The render path **never crashes the statusline**:

- All widget errors are caught and emit a safe default (null text, hidden)
- Config validation errors are caught and logged to `doctor`
- Missing config or theme files fall back to built-in defaults

Errors are never silent; they're reported via exit codes (`doctor`) or hidden renders.

## Deployment

**Distribution**: `npm install -g @agentline/cli` or `npm link --from-source`

**Wiring**: `agentline install` copies the bin to Claude Code's `statusLine` setting and seeds skills into `~/.claude/agents/`.

**Uninstall**: `agentline uninstall` reverses all changes, backing up and restoring the prior `statusLine` value.
