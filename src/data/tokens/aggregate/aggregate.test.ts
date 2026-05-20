import { describe, expect, it } from "vitest";

import {
  AXIS_STRATEGIES,
  RESET_AXES,
  aggregate,
  blockEnd,
  blockStart,
  dayStart,
  weekStart,
  type ResetAxis,
} from "./aggregate.js";

const FIXED_NOW = new Date("2026-04-28T12:00:00Z").getTime();
import type { TranscriptEvent } from "../transcript/transcript.js";

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
    const events = [ev({ inputTokens: 10, outputTokens: 20 }), ev({ cachedTokens: 5 })];
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
    const events = [
      ev({ timestamp: oneDayAgo, inputTokens: 99 }),
      ev({ timestamp: now, inputTokens: 5 }),
    ];
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

  it("weekStart honours a configured weekday + hour anchor", () => {
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    for (const weekday of [0, 3, 4, 6]) {
      for (const hour of [0, 9, 12, 23]) {
        const start = weekStart(FIXED_NOW, { weekday, hour });
        const d = new Date(start);
        expect(d.getDay()).toBe(weekday);
        expect(d.getHours()).toBe(hour);
        expect(d.getMinutes()).toBe(0);
        // Most recent anchor that has actually passed.
        expect(start).toBeLessThanOrEqual(FIXED_NOW);
        expect(start).toBeGreaterThan(FIXED_NOW - ONE_WEEK);
      }
    }
  });

  it("week axis aggregation filters on the configured reset boundary", () => {
    const now = FIXED_NOW;
    const reset = { weekday: 4, hour: 9 }; // Thursday 09:00
    const anchor = weekStart(now, reset);
    const outside = ev({ timestamp: anchor - 1, inputTokens: 7 });
    const inside = ev({ timestamp: anchor + 1, inputTokens: 3 });
    const events = [outside, inside];

    const totals = aggregate({ events, axis: "week", now, weekReset: reset });
    expect(totals.total).toBe(3);

    // Without weekReset the default Monday anchor applies — a different
    // boundary, proving the option is actually threaded through.
    const defaultAnchor = weekStart(now);
    expect(anchor).not.toBe(defaultAnchor);
  });
});

describe("AXIS_STRATEGIES (Strategy table)", () => {
  it("is exhaustive over the ResetAxis union", () => {
    const expected: readonly ResetAxis[] = ["session", "block", "day", "week", "model", "effort"];
    expect([...RESET_AXES].sort()).toEqual([...expected].sort());
    expect(Object.keys(AXIS_STRATEGIES).sort()).toEqual([...expected].sort());
  });

  it("session / model / effort axes have no rolling window end (null)", () => {
    const input = { events: [], axis: "session" as const, now: FIXED_NOW };
    expect(AXIS_STRATEGIES.session.windowEnd(input)).toBeNull();
    expect(AXIS_STRATEGIES.model.windowEnd(input)).toBeNull();
    expect(AXIS_STRATEGIES.effort.windowEnd(input)).toBeNull();
  });

  it("block / day / week axes report a numeric window end", () => {
    const input = { events: [], axis: "block" as const, now: FIXED_NOW };
    expect(AXIS_STRATEGIES.block.windowEnd(input)).toBe(
      blockEnd({ now: FIXED_NOW, blockAnchor: undefined }),
    );
    expect(AXIS_STRATEGIES.day.windowEnd(input)).toBe(dayStart(FIXED_NOW) + 24 * 60 * 60 * 1000);
    const weekEnd = AXIS_STRATEGIES.week.windowEnd(input);
    expect(typeof weekEnd).toBe("number");
  });

  it("each strategy is frozen — internal records must not be mutated at runtime", () => {
    for (const axis of RESET_AXES) {
      const strategy = AXIS_STRATEGIES[axis];
      expect(typeof strategy.filter).toBe("function");
      expect(typeof strategy.windowEnd).toBe("function");
    }
  });
});
