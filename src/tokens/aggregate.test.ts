import { describe, expect, it } from "vitest";

import { aggregate, aggregateCost, blockEnd, blockStart, dayStart, weekStart } from "./aggregate.js";

const FIXED_NOW = new Date("2026-04-28T12:00:00Z").getTime();
import type { TranscriptEvent } from "./transcript.js";

const ev = (overrides: Partial<TranscriptEvent>): TranscriptEvent => ({
  timestamp: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  compaction: false,
  ...overrides,
});

describe("aggregate", () => {
  it("sums everything for axis=session when sessionStart undefined", () => {
    const events = [
      ev({ inputTokens: 10, outputTokens: 20 }),
      ev({ cachedTokens: 5 }),
    ];
    const totals = aggregate({ events, axis: "session", now: 1000 });
    expect(totals).toEqual({ input: 10, output: 20, cached: 5, total: 35 });
  });

  it("filters out events before sessionStart", () => {
    const events = [
      ev({ timestamp: 100, inputTokens: 5 }),
      ev({ timestamp: 200, inputTokens: 10 }),
    ];
    const totals = aggregate({
      events,
      axis: "session",
      now: 1000,
      sessionStart: 150,
    });
    expect(totals.input).toBe(10);
  });

  it("axis=day filters by local midnight", () => {
    const now = FIXED_NOW;
    const oneDayAgo = now - 25 * 60 * 60 * 1000;
    const events = [ev({ timestamp: oneDayAgo, inputTokens: 99 }), ev({ timestamp: now, inputTokens: 5 })];
    const totals = aggregate({ events, axis: "day", now });
    expect(totals.input).toBe(5);
  });

  it("axis=model filters by model id", () => {
    const events = [
      ev({ model: "claude-opus-4-7", inputTokens: 10 }),
      ev({ model: "claude-sonnet-4-6", inputTokens: 20 }),
    ];
    const totals = aggregate({ events, axis: "model", now: 0, model: "claude-opus-4-7" });
    expect(totals.input).toBe(10);
  });

  it("axis=effort filters by effort tier", () => {
    const events = [
      ev({ effort: "high", inputTokens: 10 }),
      ev({ effort: "low", inputTokens: 20 }),
    ];
    const totals = aggregate({ events, axis: "effort", now: 0, effort: "high" });
    expect(totals.input).toBe(10);
  });

  it("axis=block filters to the current 5-h window", () => {
    const now = 1_700_000_000_000;
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const events = [
      ev({ timestamp: now - SIX_HOURS, inputTokens: 99 }),
      ev({ timestamp: now - 60_000, inputTokens: 5 }),
    ];
    const totals = aggregate({ events, axis: "block", now, blockAnchor: now - SIX_HOURS });
    expect(totals.input).toBe(5);
  });
});

describe("aggregateCost", () => {
  it("prices each model independently", () => {
    const events = [
      ev({ model: "claude-opus-4-7", inputTokens: 1_000_000 }),
      ev({ model: "claude-sonnet-4-6", outputTokens: 1_000_000 }),
    ];
    const cost = aggregateCost({ events, axis: "session", now: 0 });
    expect(cost).toBeCloseTo(15 + 15, 4);
  });

  it("uses ctx model when an event omits it", () => {
    const events = [ev({ inputTokens: 1_000_000 })];
    const cost = aggregateCost({ events, axis: "session", now: 0, model: "claude-haiku-4-5" });
    expect(cost).toBeCloseTo(1, 4);
  });
});

describe("axis helpers", () => {
  it("blockStart and blockEnd straddle a 5-h window", () => {
    const now = 1_700_000_000_000;
    const start = blockStart({ now, blockAnchor: now });
    const end = blockEnd({ now, blockAnchor: now });
    expect(end - start).toBe(5 * 60 * 60 * 1000);
    expect(start).toBeLessThanOrEqual(now);
  });

  it("dayStart returns the most recent local midnight", () => {
    const start = dayStart(FIXED_NOW);
    const d = new Date(start);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("weekStart returns Monday 00:00", () => {
    const start = weekStart(FIXED_NOW);
    const d = new Date(start);
    expect(d.getDay()).toBe(1);
    expect(d.getHours()).toBe(0);
  });
});
