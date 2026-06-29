/**
 * Shared frozen-object builders for the most common test inputs.
 *
 * Every factory:
 *   - returns an `Object.freeze`d value (matches the production
 *     resolver shapes — widgets / merge layers / render path all
 *     observe frozen inputs);
 *   - accepts a `Partial<T>` of overrides spread last (right-wins);
 *   - is pure — no I/O, no time access except via `canonicalClock`.
 *
 * Use these instead of hand-rolling `makeSnapshot` / `makeCtx` in test
 * files. Test authors who need a non-default instant pass `clock:
 * frozenClock("…")` through the `WidgetContext` overrides.
 */

import { DEFAULT_CONFIG } from "../../data/config/index.js";
import type { GitSnapshot } from "../../data/git/index.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../data/tokens/index.js";
import type { Cell, WidgetContext } from "../../widgets/types.js";

import { canonicalClock } from "../clock/clock.js";

/** A minimal, well-typed empty stdin payload — `{ raw: {}, truncated: false }`. */
export function makeStdinPayload(overrides: Partial<StdinPayload> = {}): StdinPayload {
  return Object.freeze({
    raw: {},
    truncated: false,
    ...overrides,
  });
}

/**
 * Default-clean git snapshot pinned to `main` on `/repo` with a frozen
 * 40-char SHA. Override `branch`, `status`, `pr`, etc. via `overrides`.
 *
 * Snapshot invariant: `prSource === null` iff `pr === null`. When you
 * override `pr` with a non-null PR, also set `prSource` to `"host"` or
 * `"network"` — the default leaves `prSource: null`, which is a malformed
 * pairing the `git-pr` widget deliberately hides.
 */
export function makeGitSnapshot(overrides: Partial<GitSnapshot> = {}): GitSnapshot {
  return Object.freeze({
    available: true,
    cwd: "/repo",
    branch: "main",
    detached: false,
    sha: "abcdef0123456789abcdef0123456789abcdef01",
    shortSha: "abcdef0",
    status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 0 },
    diff: { insertions: 0, deletions: 0, filesChanged: 0 },
    diffStaged: { insertions: 0, deletions: 0, filesChanged: 0 },
    aheadBehind: { ahead: 0, behind: 0 },
    upstream: null,
    origin: null,
    upstreamRemote: null,
    worktreeName: null,
    inWorktree: false,
    pr: null,
    prSource: null,
    ...overrides,
  });
}

/** Empty-default `TranscriptEvent`, intended for inline `ev({ … })` use. */
export function makeTranscriptEvent(overrides: Partial<TranscriptEvent> = {}): TranscriptEvent {
  return {
    timestamp: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    compaction: false,
    ...overrides,
  };
}

/**
 * Tokens snapshot pinned to a 200k context window with `events` placed
 * explicitly. `now` / `sessionStart` / `blockAnchor` default to the
 * first event's timestamp (or `1_000_000` ms when `events` is empty),
 * so callers that don't care about wall-time can pass `[]` and forget.
 */
export function makeTokensSnapshot(
  events: readonly TranscriptEvent[] = [],
  overrides: Partial<TokensSnapshot> = {},
): TokensSnapshot {
  const fallbackNow = 1_000_000;
  const firstTimestamp = events[0]?.timestamp;
  const now = overrides.now ?? firstTimestamp ?? fallbackNow;
  const sessionStart =
    overrides.sessionStart !== undefined ? overrides.sessionStart : (firstTimestamp ?? now);
  const blockAnchor =
    overrides.blockAnchor !== undefined ? overrides.blockAnchor : (firstTimestamp ?? now);
  return Object.freeze({
    events: Object.freeze([...events]) as readonly TranscriptEvent[],
    now,
    sessionStart,
    blockAnchor,
    contextWindow: 200_000,
    ...overrides,
  });
}

/**
 * Widget render context with `stdin: makeStdinPayload()`, `config:
 * DEFAULT_CONFIG`, `theme: null`, `clock: canonicalClock()`, `env: {}`.
 *
 * Pass `git`, `tokens`, `theme`, `session`, `plan`, `t`, or a different
 * `clock` through `overrides`. The spread is right-wins, so an explicit
 * `git: undefined` correctly leaves the field unset (the type already
 * allows it).
 */
export function makeWidgetContext(overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    stdin: makeStdinPayload(),
    config: DEFAULT_CONFIG,
    theme: null,
    clock: canonicalClock(),
    env: {},
    ...overrides,
  };
}

/** Minimal `Cell` builder — `text: ""` by default. */
export function makeCell(overrides: Partial<Cell> = {}): Cell {
  return Object.freeze({
    text: "",
    ...overrides,
  });
}
