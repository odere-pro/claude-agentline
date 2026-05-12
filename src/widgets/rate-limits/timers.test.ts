import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import {
  blockResetTimerWidget,
  blockTimerWidget,
  weeklyResetTimerWidget,
} from "./timers.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };
const HOUR_MS = 60 * 60 * 1000;

const ev = (overrides: Partial<TranscriptEvent>): TranscriptEvent => ({
  timestamp: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  compaction: false,
  ...overrides,
});

function makeSnapshot(
  events: TranscriptEvent[],
  overrides: Partial<TokensSnapshot> = {},
): TokensSnapshot {
  const now = overrides.now ?? Date.parse("2026-05-01T03:00:00Z");
  return Object.freeze({
    events: Object.freeze(events) as readonly TranscriptEvent[],
    now,
    sessionStart: events[0]?.timestamp ?? now,
    blockAnchor: overrides.blockAnchor ?? (events[0]?.timestamp ?? now),
    contextWindow: 200_000,
    pricingVersion: "test",
    ...overrides,
  });
}

function makeCtx(
  snapshot: TokensSnapshot | undefined,
  clockAt?: string,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  const now = snapshot?.now ?? Date.parse("2026-05-01T03:00:00Z");
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock(clockAt ?? new Date(now)),
    env: {},
    tokens: snapshot,
    ...overrides,
  };
}

describe("block-timer widget", () => {
  it("shows remaining time anchored to the block", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 90 * 60 * 1000;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockTimerWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("3h30m");
  });

  it("clock format renders HH:MM:SS", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 90 * 60 * 1000;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockTimerWidget.render(makeCtx(snap), {
      options: { format: "clock" },
      rawValue: false,
    });
    expect(cell.text).toBe("03:30:00");
  });

  it("falls back to 5h0m when no snapshot is present", () => {
    const cell = blockTimerWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.text).toBe("5h0m");
  });

  it("suppresses label when rawValue: true", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const withLabel = blockTimerWidget.render(makeCtx(snap), {
      options: { label: "block:" },
      rawValue: false,
    });
    const noLabel = blockTimerWidget.render(makeCtx(snap), {
      options: { label: "block:" },
      rawValue: true,
    });
    expect(withLabel.text).toMatch(/^block:/);
    expect(noLabel.text).not.toMatch(/^block:/);
  });
});

describe("block-reset-timer widget", () => {
  it("shows 'resets N' as default label", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetTimerWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("resets 1h0m");
  });

  it("rawValue strips the default 'resets ' label", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text).toBe("1h0m");
  });

  it("respects custom label override", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetTimerWidget.render(makeCtx(snap), {
      options: { label: "reset in: " },
      rawValue: false,
    });
    expect(cell.text).toMatch(/^reset in: /);
  });
});

describe("weekly-reset-timer widget", () => {
  it("renders with the 'week resets ' default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("renders a non-empty duration after the label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(/\d/.test(cell.text)).toBe(true);
  });

  it("works without a snapshot (clock-only)", () => {
    const cell = weeklyResetTimerWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("rawValue strips the default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text.startsWith("week resets ")).toBe(false);
    expect(/\d/.test(cell.text)).toBe(true);
  });

  it("long format produces a space-separated duration", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetTimerWidget.render(makeCtx(snap), {
      options: { format: "long" },
      rawValue: true,
    });
    // Long format either has "h N m" or just "N m"
    expect(/\d+h \d+m|\d+m/.test(cell.text)).toBe(true);
  });
});
