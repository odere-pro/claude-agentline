/**
 * Rolling-window speed (tokens / second) for `*-speed` widgets.
 * Default window is 60 s (§7.3). Computes input, output, and total
 * rates from the events that fall within `[now - windowMs, now]`.
 */

import type { TranscriptEvent } from "./transcript.js";

export interface SpeedInput {
  readonly events: readonly TranscriptEvent[];
  readonly now: number;
  readonly windowMs: number;
}

export interface SpeedTotals {
  readonly inputPerSec: number;
  readonly outputPerSec: number;
  readonly totalPerSec: number;
}

export function rollingSpeed(input: SpeedInput): SpeedTotals {
  const start = input.now - input.windowMs;
  let inTok = 0;
  let outTok = 0;
  for (const ev of input.events) {
    if (ev.timestamp < start) continue;
    inTok += ev.inputTokens;
    outTok += ev.outputTokens;
  }
  const seconds = input.windowMs / 1000;
  return {
    inputPerSec: inTok / seconds,
    outputPerSec: outTok / seconds,
    totalPerSec: (inTok + outTok) / seconds,
  };
}
