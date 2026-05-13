import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";

import { formatDuration, resolveDurationFormat } from "./duration.js";
import { blockResetTimerWidget, weeklyResetTimerWidget } from "./timers.js";
import { sessionUsageWidget } from "./usage.js";
import { RATE_LIMIT_WIDGETS, registerRateLimitWidgets } from "./index.js";

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
  const blockAnchor =
    overrides.blockAnchor !== undefined
      ? overrides.blockAnchor
      : (events[0]?.timestamp ?? now);
  const sessionStart =
    overrides.sessionStart !== undefined
      ? overrides.sessionStart
      : (events[0]?.timestamp ?? now);
  return Object.freeze({
    events: Object.freeze(events) as readonly TranscriptEvent[],
    now,
    sessionStart,
    blockAnchor,
    contextWindow: 200_000,
    pricingVersion: "test",
    ...overrides,
  });
}

function makeCtx(
  snapshot: TokensSnapshot | undefined,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  const now = snapshot?.now ?? Date.parse("2026-05-01T03:00:00Z");
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock(new Date(now)),
    env: {},
    tokens: snapshot,
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("short format omits hour segment when zero", () => {
    expect(formatDuration(0, "short")).toBe("0m");
    expect(formatDuration(45 * 60 * 1000, "short")).toBe("45m");
  });

  it("short format combines hours and minutes without space", () => {
    expect(formatDuration(3 * HOUR_MS + 12 * 60 * 1000, "short")).toBe("3h12m");
  });

  it("long format adds a space between hours and minutes", () => {
    expect(formatDuration(3 * HOUR_MS + 12 * 60 * 1000, "long")).toBe("3h 12m");
    expect(formatDuration(45 * 60 * 1000, "long")).toBe("45m");
  });

  it("clock format uses HH:MM:SS", () => {
    expect(formatDuration(3 * HOUR_MS + 12 * 60 * 1000 + 5_000, "clock")).toBe("03:12:05");
    expect(formatDuration(0, "clock")).toBe("00:00:00");
  });

  it("clamps negative inputs to zero", () => {
    expect(formatDuration(-1_000, "short")).toBe("0m");
    expect(formatDuration(-1_000, "clock")).toBe("00:00:00");
  });

  it("resolveDurationFormat falls back on unknown input", () => {
    expect(resolveDurationFormat("clock")).toBe("clock");
    expect(resolveDurationFormat("garbage")).toBe("short");
    expect(resolveDurationFormat(undefined, "long")).toBe("long");
  });
});

describe("registerRateLimitWidgets", () => {
  it("ships exactly three widgets in sorted order", () => {
    const r = new WidgetRegistry();
    registerRateLimitWidgets(r);
    expect(r.size()).toBe(3);
    expect(r.list()).toEqual([
      "block-reset-timer",
      "session-usage",
      "weekly-reset-timer",
    ]);
    expect(Object.isFrozen(RATE_LIMIT_WIDGETS)).toBe(true);
    expect(RATE_LIMIT_WIDGETS).toHaveLength(3);
  });
});

describe("session-usage widget", () => {
  const NOW = Date.parse("2026-05-01T03:00:00Z");
  const recent = (overrides: Partial<TranscriptEvent>): TranscriptEvent =>
    ev({ timestamp: NOW - 30 * 60 * 1000, ...overrides });

  it("hides when no snapshot is supplied", () => {
    const cell = sessionUsageWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("falls back to formatCount when no limit is set", () => {
    const snap = makeSnapshot([recent({ inputTokens: 50_000, outputTokens: 5_000 })], {
      now: NOW,
    });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("55k");
  });

  it("renders a percent against the configured limit", () => {
    const snap = makeSnapshot([recent({ inputTokens: 60_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.text).toBe("60%");
  });

  it("colour grades via tokens-low / mid / high roles", () => {
    const snap = makeSnapshot([recent({ inputTokens: 90_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-high"]);
  });

  it("renders a 12-cell bar by default for display=bar", () => {
    const snap = makeSnapshot([recent({ inputTokens: 50_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000, display: "bar" },
      rawValue: false,
    });
    expect(cell.text.length).toBe(12);
    expect(cell.text.startsWith("█")).toBe(true);
  });

  it("renders a short bar at 6 cells", () => {
    const snap = makeSnapshot([recent({ inputTokens: 50_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000, display: "short-bar" },
      rawValue: false,
    });
    expect(cell.text.length).toBe(6);
  });

  it("filters events to the current 5-h block", () => {
    const now = Date.parse("2026-05-01T10:00:00Z");
    const oldEv = ev({
      timestamp: Date.parse("2026-05-01T03:00:00Z"),
      inputTokens: 999_999,
    });
    const recentEv = ev({
      timestamp: Date.parse("2026-05-01T09:30:00Z"),
      inputTokens: 1_000,
    });
    const snap = makeSnapshot([oldEv, recentEv], { now, blockAnchor: oldEv.timestamp });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 10_000 },
      rawValue: false,
    });
    expect(cell.text).toBe("10%");
  });

  it("rawValue suppresses label", () => {
    const snap = makeSnapshot([recent({ inputTokens: 1_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { label: "block ", limit: 10_000 },
      rawValue: true,
    });
    expect(cell.text).toBe("10%");
  });
});

describe("block-reset-timer widget", () => {
  it("default label says 'resets '", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("resets 1h0m");
  });

  it("rawValue strips the default label", () => {
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

  it("clock format renders HH:MM:SS", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetTimerWidget.render(makeCtx(snap), {
      options: { format: "clock" },
      rawValue: false,
    });
    expect(cell.text).toBe("resets 01:00:00");
  });

  it("falls back to current time when no snapshot is present", () => {
    const cell = blockResetTimerWidget.render(makeCtx(undefined), {
      options: { format: "short" },
      rawValue: true,
    });
    expect(cell.text).toBe("5h0m");
  });
});

describe("weekly-reset-timer widget", () => {
  it("counts down to next local Monday 00:00", () => {
    const monday = Date.parse("2026-04-27T00:00:00Z");
    const tuesday = monday + 24 * HOUR_MS;
    const snap = makeSnapshot([], { now: tuesday });
    const cell = weeklyResetTimerWidget.render(makeCtx(snap), {
      options: { format: "long" },
      rawValue: false,
    });
    // Locale-dependent (the spec defines week boundary as local Monday
    // 00:00). The widget delegates to weekStart which uses the local
    // calendar, so we only assert the label + non-empty body shape.
    expect(cell.text.startsWith("week resets ")).toBe(true);
    expect(/\d+(h \d+m| ?m)/.test(cell.text)).toBe(true);
  });

  it("works without a snapshot (clock-only)", () => {
    const cell = weeklyResetTimerWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });
});
