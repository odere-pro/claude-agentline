import { describe, expect, it } from "vitest";

import { rollingSpeed } from "./speed.js";
import type { TranscriptEvent } from "./transcript.js";

const ev = (overrides: Partial<TranscriptEvent>): TranscriptEvent => ({
  timestamp: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  compaction: false,
  ...overrides,
});

describe("rollingSpeed", () => {
  it("returns zero rates for empty input", () => {
    const speed = rollingSpeed({ events: [], now: 1000, windowMs: 60_000 });
    expect(speed).toEqual({ inputPerSec: 0, outputPerSec: 0, totalPerSec: 0 });
  });

  it("ignores events older than windowMs", () => {
    const now = 60_000;
    const events = [
      ev({ timestamp: 0, inputTokens: 600 }),
      ev({ timestamp: 30_000, inputTokens: 60 }),
    ];
    const speed = rollingSpeed({ events, now, windowMs: 30_000 });
    expect(speed.inputPerSec).toBe(2);
  });

  it("computes total = input + output", () => {
    const events = [ev({ timestamp: 50, inputTokens: 60, outputTokens: 30 })];
    const speed = rollingSpeed({ events, now: 100, windowMs: 60_000 });
    expect(speed.totalPerSec).toBeCloseTo(speed.inputPerSec + speed.outputPerSec);
  });
});
