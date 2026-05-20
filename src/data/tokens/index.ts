/**
 * Token / context data layer used by widgets in PR 11.
 *
 * The render-tick resolver (`loadTokensSnapshot`) reads the JSONL
 * transcript once and freezes a snapshot widgets can index into.
 * Widgets MUST read from `ctx.tokens` and never touch the filesystem
 * during `render()` (§1.2 N3).
 */

import { contextWindowFor } from "./context-window/context-window.js";
import { readTranscript, type TranscriptEvent } from "./transcript/transcript.js";

export type {
  AxisFilter,
  AxisStrategy,
  ResetAxis,
  TokenTotals,
  WeekResetOpts,
} from "./aggregate/aggregate.js";
export { AXIS_STRATEGIES, RESET_AXES, aggregate, blockEnd, weekStart } from "./aggregate/aggregate.js";
export { rollingSpeed } from "./speed/speed.js";
export { contextWindowFor } from "./context-window/context-window.js";
export type { TranscriptEvent } from "./transcript/transcript.js";

export interface TokensSnapshot {
  /** Parsed transcript events; `[]` when the file is missing/unreadable. */
  readonly events: readonly TranscriptEvent[];
  /** Wall-clock time used for axis arithmetic. */
  readonly now: number;
  /** Session start (ms epoch) — earliest event in the file. */
  readonly sessionStart?: number;
  /** Block anchor (ms epoch) — first-event hour, the §8.4 contract. */
  readonly blockAnchor?: number;
  /** Current model context window in tokens. */
  readonly contextWindow: number;
}

export interface LoadTokensInput {
  readonly transcriptPath: string | undefined;
  readonly modelId: string | undefined;
  readonly now: number;
}

export function loadTokensSnapshot(input: LoadTokensInput): TokensSnapshot {
  const events = readTranscript(input.transcriptPath, input.now);
  const sessionStart = events[0]?.timestamp;
  const blockAnchor = sessionStart;
  return Object.freeze({
    events,
    now: input.now,
    sessionStart,
    blockAnchor,
    contextWindow: contextWindowFor(input.modelId),
  });
}
