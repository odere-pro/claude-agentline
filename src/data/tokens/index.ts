/**
 * Token / cost / context data layer used by widgets in PR 11.
 *
 * The render-tick resolver (`loadTokensSnapshot`) reads the JSONL
 * transcript once and freezes a snapshot widgets can index into.
 * Widgets MUST read from `ctx.tokens` and never touch the filesystem
 * during `render()` (§1.2 N3).
 */

import { contextWindowFor } from "./context-window.js";
import { PRICING_TABLE_VERSION } from "./pricing.js";
import { readTranscript, type TranscriptEvent } from "./transcript.js";

export type { ResetAxis, TokenTotals, WeekResetOpts } from "./aggregate.js";
export { aggregate, blockEnd, weekStart } from "./aggregate.js";
export { rollingSpeed } from "./speed.js";
export { PRICING_TABLE_VERSION } from "./pricing.js";
export { contextWindowFor } from "./context-window.js";
export type { TranscriptEvent } from "./transcript.js";

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
  /** Pricing table version, surfaced to `agentline doctor`. */
  readonly pricingVersion: string;
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
    pricingVersion: PRICING_TABLE_VERSION,
  });
}
