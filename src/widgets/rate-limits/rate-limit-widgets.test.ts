/**
 * Consolidated test surface for every widget in `src/widgets/rate-limits/`.
 *
 * Rate-limit widgets (timers, reset-at, usage) share common patterns and
 * test fixtures. They were consolidated into a single file to speed up the
 * test run and reduce boilerplate. Trade-off: a single failure masks which
 * widget broke. If frequent churn occurs, re-split into per-widget files.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";

import { formatDuration, resolveDurationFormat } from "./duration.js";
import { blockResetAtWidget, weeklyResetAtWidget } from "./reset-at.js";
import { blockResetTimerWidget, weeklyResetTimerWidget } from "./timers.js";
import {
  sessionUsageWidget,
  weeklyOpusUsageWidget,
  weeklySonnetUsageWidget,
} from "./usage.js";
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
  it("ships exactly five widgets in sorted order", () => {
    const r = new WidgetRegistry();
    registerRateLimitWidgets(r);
    expect(r.size()).toBe(7);
    expect(r.list()).toEqual([
      "block-reset-at",
      "block-reset-timer",
      "session-usage",
      "weekly-opus-usage",
      "weekly-reset-at",
      "weekly-reset-timer",
      "weekly-sonnet-usage",
    ]);
    expect(Object.isFrozen(RATE_LIMIT_WIDGETS)).toBe(true);
    expect(RATE_LIMIT_WIDGETS).toHaveLength(7);
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

  it("colour grades via tokens-high at 90%", () => {
    const snap = makeSnapshot([recent({ inputTokens: 90_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-high"]);
  });

  it("colour grades via tokens-low below 60%", () => {
    const snap = makeSnapshot([recent({ inputTokens: 30_000 })], { now: NOW });
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-low"]);
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

describe("weekly-sonnet-usage / weekly-opus-usage widgets", () => {
  // Anchor inside the week so any "older than 7 days" timestamps fall
  // before the local-week boundary regardless of which weekday `NOW`
  // lands on.
  const NOW = Date.parse("2026-05-08T12:00:00Z"); // Friday
  const sameWeek = (overrides: Partial<TranscriptEvent>): TranscriptEvent =>
    ev({ timestamp: NOW - 2 * HOUR_MS, ...overrides });
  // 30 days back — always before the local-week boundary no matter
  // which day the test runs.
  const lastMonth = (overrides: Partial<TranscriptEvent>): TranscriptEvent =>
    ev({ timestamp: NOW - 30 * 24 * HOUR_MS, ...overrides });

  it("hides when no snapshot is supplied", () => {
    const sonnetCell = weeklySonnetUsageWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    const opusCell = weeklyOpusUsageWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(sonnetCell.hidden).toBe(true);
    expect(opusCell.hidden).toBe(true);
  });

  it("sums only Sonnet events for the Sonnet widget", () => {
    const snap = makeSnapshot(
      [
        sameWeek({ model: "claude-sonnet-4-6", inputTokens: 30_000 }),
        sameWeek({ model: "claude-opus-4-7", inputTokens: 999_999 }),
        sameWeek({ model: "claude-haiku-4-5", inputTokens: 999_999 }),
      ],
      { now: NOW },
    );
    const cell = weeklySonnetUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.text).toBe("30%");
  });

  it("sums only Opus events for the Opus widget", () => {
    const snap = makeSnapshot(
      [
        sameWeek({ model: "claude-sonnet-4-6", inputTokens: 999_999 }),
        sameWeek({ model: "claude-opus-4-7", inputTokens: 45_000 }),
        sameWeek({ model: "claude-opus-4-7[1m]", inputTokens: 5_000 }),
      ],
      { now: NOW },
    );
    const cell = weeklyOpusUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    // 45k + 5k = 50k against 100k = 50%. The `[1m]` variant is still
    // an Opus family member via prefix match.
    expect(cell.text).toBe("50%");
  });

  it("excludes events outside the current local week", () => {
    const snap = makeSnapshot(
      [
        lastMonth({ model: "claude-sonnet-4-6", inputTokens: 999_999 }),
        sameWeek({ model: "claude-sonnet-4-6", inputTokens: 10_000 }),
      ],
      { now: NOW },
    );
    const cell = weeklySonnetUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.text).toBe("10%");
  });

  it("skips events with no model id", () => {
    const snap = makeSnapshot(
      [
        sameWeek({ inputTokens: 999_999 }), // no model → unattributable
        sameWeek({ model: "claude-sonnet-4-6", inputTokens: 20_000 }),
      ],
      { now: NOW },
    );
    const cell = weeklySonnetUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.text).toBe("20%");
  });

  it("falls back to formatCount when no limit is set", () => {
    const snap = makeSnapshot(
      [sameWeek({ model: "claude-sonnet-4-6", inputTokens: 1_500, outputTokens: 500 })],
      { now: NOW },
    );
    const cell = weeklySonnetUsageWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("2k");
  });

  it("renders a 12-cell bar for display=bar", () => {
    const snap = makeSnapshot(
      [sameWeek({ model: "claude-opus-4-7", inputTokens: 50_000 })],
      { now: NOW },
    );
    const cell = weeklyOpusUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000, display: "bar" },
      rawValue: false,
    });
    expect(cell.text.length).toBe(12);
    expect(cell.text.startsWith("█")).toBe(true);
  });

  it("rawValue suppresses label", () => {
    const snap = makeSnapshot(
      [sameWeek({ model: "claude-opus-4-7", inputTokens: 1_000 })],
      { now: NOW },
    );
    const cell = weeklyOpusUsageWidget.render(makeCtx(snap), {
      options: { label: "opus ", limit: 10_000 },
      rawValue: true,
    });
    expect(cell.text).toBe("10%");
  });

  it("Sonnet and Opus families do not bleed across each other", () => {
    // Pure cross-check: a snapshot containing only Sonnet events
    // returns zero (0%) for the Opus widget, and vice versa.
    const sonnetOnly = makeSnapshot(
      [sameWeek({ model: "claude-sonnet-4-6", inputTokens: 10_000 })],
      { now: NOW },
    );
    const opusOnly = makeSnapshot(
      [sameWeek({ model: "claude-opus-4-7", inputTokens: 10_000 })],
      { now: NOW },
    );
    expect(
      weeklyOpusUsageWidget.render(makeCtx(sonnetOnly), {
        options: { limit: 100_000 },
        rawValue: false,
      }).text,
    ).toBe("0%");
    expect(
      weeklySonnetUsageWidget.render(makeCtx(opusOnly), {
        options: { limit: 100_000 },
        rawValue: false,
      }).text,
    ).toBe("0%");
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

  it("respects a custom label override", () => {
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

  it("rawValue strips the default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text.startsWith("week resets ")).toBe(false);
    expect(/\d/.test(cell.text)).toBe(true);
  });
});

describe("block-reset-at widget", () => {
  it("renders the wall-clock of the next block reset with default label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { tz: "UTC" },
      rawValue: false,
    });
    // 5h block anchored at 13:00 UTC → next reset at 18:00 UTC.
    expect(cell.text).toBe("resets 18:00");
  });

  it("rawValue strips the default label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("18:00");
  });

  it("honours options.format (12-hour with am/pm)", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { format: "h:mma", tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("6:00pm");
  });

  it("falls back to now + 5h when no snapshot is present", () => {
    const ctx = {
      stdin: baseStdin,
      config: DEFAULT_CONFIG,
      theme: null,
      clock: frozenClock("2026-05-01T13:00:00Z"),
      env: {},
    } as WidgetContext;
    const cell = blockResetAtWidget.render(ctx, {
      options: { tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("18:00");
  });

  it("respects a custom label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { label: "next ", tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("next 18:00");
  });
});

describe("weekly-reset-at widget", () => {
  it("renders with 'week resets ' default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetAtWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("emits a HH:mm clock body after the label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetAtWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toMatch(/^week resets \d{2}:\d{2}$/);
  });

  it("works without a snapshot (clock-only)", () => {
    const ctx = {
      stdin: baseStdin,
      config: DEFAULT_CONFIG,
      theme: null,
      clock: frozenClock("2026-04-28T12:00:00Z"),
      env: {},
    } as WidgetContext;
    const cell = weeklyResetAtWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("rawValue strips the default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetAtWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text.startsWith("week resets ")).toBe(false);
    expect(cell.text).toMatch(/^\d{2}:\d{2}$/);
  });
});
