/**
 * Consolidated test surface for every widget in `src/widgets/rate-limits/`.
 *
 * Rate-limit widgets (timers, usage) share common patterns and test
 * fixtures. They were consolidated into a single file to speed up the
 * test run and reduce boilerplate. Trade-off: a single failure masks which
 * widget broke. If frequent churn occurs, re-split into per-widget files.
 *
 * The former `current-session-reset-at` and `weekly-reset-at` widgets
 * were folded into wall-clock format variants of the timer widgets
 * (PR #258). Their absolute-time render behaviour is now tested here
 * via clock-format option strings.
 */

import { describe, expect, it } from "vitest";

import type { StdinPayload } from "../../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../data/tokens/index.js";

import {
  frozenClock,
  makeTokensSnapshot,
  makeTranscriptEvent as ev,
  makeWidgetContext,
} from "../../test-helpers/index.js";
import type { WidgetContext } from "../types.js";
import { WidgetRegistry } from "../registry/registry.js";

import { formatDuration, resolveDurationFormat } from "./duration/duration.js";
import { currentSessionResetTimerWidget, weekLimitTimerWidget } from "./timers.js";
import { sessionWeeklyUsageWidget } from "./usage.js";
import { resolveWeekReset } from "./week-reset.js";
import { RATE_LIMIT_WIDGETS, registerRateLimitWidgets } from "./index.js";

const HOUR_MS = 60 * 60 * 1000;
/** Pinned wall-clock for snapshot defaults so the tests stay deterministic. */
const FIXED_NOW_MS = Date.parse("2026-05-01T03:00:00Z");

const makeSnapshot = (events: TranscriptEvent[], overrides: Partial<TokensSnapshot> = {}) =>
  makeTokensSnapshot(events, { now: FIXED_NOW_MS, ...overrides });

const makeCtx = (snapshot: TokensSnapshot | undefined, overrides: Partial<WidgetContext> = {}) =>
  makeWidgetContext({
    tokens: snapshot,
    clock: frozenClock(new Date(snapshot?.now ?? FIXED_NOW_MS)),
    ...overrides,
  });

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

describe("resolveWeekReset", () => {
  it("returns undefined when neither option is a valid integer", () => {
    expect(resolveWeekReset({})).toBeUndefined();
    expect(resolveWeekReset({ resetWeekday: 7, resetHour: 24 })).toBeUndefined();
    expect(resolveWeekReset({ resetWeekday: -1 })).toBeUndefined();
    expect(resolveWeekReset({ resetHour: 2.5 })).toBeUndefined();
  });

  it("passes through valid weekday/hour and drops invalid siblings", () => {
    expect(resolveWeekReset({ resetWeekday: 4, resetHour: 12 })).toEqual({ weekday: 4, hour: 12 });
    expect(resolveWeekReset({ resetWeekday: 0 })).toEqual({ weekday: 0 });
    expect(resolveWeekReset({ resetWeekday: 99, resetHour: 9 })).toEqual({ hour: 9 });
  });
});

describe("registerRateLimitWidgets", () => {
  it("ships exactly three widgets in sorted order", () => {
    const r = new WidgetRegistry();
    registerRateLimitWidgets(r);
    expect(r.size()).toBe(3);
    expect(r.list()).toEqual([
      "current-session-reset-timer",
      "session-weekly-usage",
      "week-limit-timer",
    ]);
    expect(Object.isFrozen(RATE_LIMIT_WIDGETS)).toBe(true);
    expect(RATE_LIMIT_WIDGETS).toHaveLength(3);
  });
});

type RateLimits = NonNullable<StdinPayload["rateLimits"]>;

function stdinWith(rateLimits?: RateLimits, raw: Record<string, unknown> = {}): StdinPayload {
  return { raw, truncated: false, ...(rateLimits ? { rateLimits } : {}) };
}

describe("session-weekly-usage widget", () => {
  it("hides when the host ships no rate_limits block", () => {
    const cell = sessionWeeklyUsageWidget.render(makeCtx(undefined, { stdin: stdinWith() }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when neither window carries a percentage", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ fiveHour: {}, sevenDay: {} }) }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders both windows as '52% · weekly 33%'", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { usedPercentage: 52 },
          sevenDay: { usedPercentage: 33 },
        }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("52% · weekly 33%");
  });

  it("shows the session half alone when the weekly window is absent", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ fiveHour: { usedPercentage: 52 } }) }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("52%");
  });

  it("shows the weekly half alone when the session window is absent", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ sevenDay: { usedPercentage: 33 } }) }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("weekly 33%");
  });

  it("emits no state-signal colour so the rate-limits family accent applies", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { usedPercentage: 90 },
          sevenDay: { usedPercentage: 80 },
        }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBeUndefined();
    expect(cell.signal).toBeUndefined();
  });

  it("prefixes the configured plan name once", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { usedPercentage: 52 },
          sevenDay: { usedPercentage: 33 },
        }),
      }),
      { options: { plan: "Max" }, rawValue: false },
    );
    expect(cell.text).toBe("Max 52% · weekly 33%");
  });

  it("a host-provided raw.plan wins over the configured plan", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith(
          { fiveHour: { usedPercentage: 52 }, sevenDay: { usedPercentage: 33 } },
          { plan: "Team" },
        ),
      }),
      { options: { plan: "Max" }, rawValue: false },
    );
    expect(cell.text).toBe("Team 52% · weekly 33%");
  });

  it("clamps an over-budget percentage at 100 (host values above 100 are capped)", () => {
    // A host value > 100 means over-quota. The display caps at 100 to
    // avoid printing absurd values like "999%" or "4000%".
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { usedPercentage: 4000 },
          sevenDay: { usedPercentage: 33 },
        }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("100% · weekly 33%");
  });

  it("rawValue strips the label and plan prefix", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { usedPercentage: 52 },
          sevenDay: { usedPercentage: 33 },
        }),
      }),
      { options: { label: "usage ", plan: "Max" }, rawValue: true },
    );
    expect(cell.text).toBe("52% · weekly 33%");
  });
});

describe("current-session-reset-timer widget — countdown", () => {
  it("default label says 'reset in ' with the compact minute-aware format", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("reset in 1h 0m");
  });

  it("rawValue strips the default label", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text).toBe("1h 0m");
  });

  it("clock format renders HH:MM:SS", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: { format: "clock" },
      rawValue: false,
    });
    expect(cell.text).toBe("reset in 01:00:00");
  });

  it("falls back to current time when no snapshot is present", () => {
    const cell = currentSessionResetTimerWidget.render(makeCtx(undefined), {
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
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: { label: "reset in: " },
      rawValue: false,
    });
    expect(cell.text).toMatch(/^reset in: /);
  });
});

describe("current-session-reset-timer widget — wall-clock (at-* variants)", () => {
  it("HH:mm format renders the absolute session reset time with 'resets ' label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: { format: "HH:mm", tz: "UTC" },
      rawValue: false,
    });
    // 5h block anchored at 13:00 UTC → next reset at 18:00 UTC.
    expect(cell.text).toBe("resets 18:00");
  });

  it("rawValue strips the label in wall-clock mode", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: { format: "HH:mm", tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("18:00");
  });

  it("h:mma format renders 12-hour time with am/pm", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: { format: "h:mma", tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("6:00pm");
  });

  it("falls back to now + 5h when no snapshot is present (wall-clock)", () => {
    const ctx = makeWidgetContext({ clock: frozenClock("2026-05-01T13:00:00Z") });
    const cell = currentSessionResetTimerWidget.render(ctx, {
      options: { format: "HH:mm", tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("18:00");
  });

  it("custom label overrides the default 'resets ' label in wall-clock mode", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap), {
      options: { label: "next ", format: "HH:mm", tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("next 18:00");
  });
});

describe("week-limit-timer widget — countdown", () => {
  it("counts down to next local Monday 00:00 by default", () => {
    const monday = Date.parse("2026-04-27T00:00:00Z");
    const tuesday = monday + 24 * HOUR_MS;
    const snap = makeSnapshot([], { now: tuesday });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: { format: "long" },
      rawValue: false,
    });
    /*
     * Locale-dependent (the default week boundary is local Monday
     * 00:00). The widget delegates to weekStart which uses the local
     * calendar, so we only assert the label + non-empty body shape.
     */
    expect(cell.text.startsWith("reset in ")).toBe(true);
    expect(/\d+(h \d+m| ?m)/.test(cell.text)).toBe(true);
  });

  it("works without a snapshot (clock-only)", () => {
    const cell = weekLimitTimerWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.text.startsWith("reset in ")).toBe(true);
  });

  it("a configured reset anchor still renders a bounded countdown", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: { resetWeekday: 4, resetHour: 12, format: "compact" },
      rawValue: true,
    });
    // Within (0, 7d] of the configured anchor → matches the compact shape.
    expect(/^(\d+d \d+h \d+m|\d+h \d+m|\d+m)$/.test(cell.text)).toBe(true);
  });

  it("rawValue strips the default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text.startsWith("reset in ")).toBe(false);
    expect(/\d/.test(cell.text)).toBe(true);
  });
});

describe("week-limit-timer widget — wall-clock (at-* variants)", () => {
  it("EEE D HH:mm format renders with 'week resets ' default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: { format: "EEE D HH:mm" },
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("EEE D HH:mm body matches 'EEE D HH:mm' shape", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: { format: "EEE D HH:mm" },
      rawValue: false,
    });
    expect(cell.text).toMatch(/^week resets \w{3} \d{1,2} \d{2}:\d{2}$/);
  });

  it("a configured Thursday reset lands on Thursday (wall-clock mode)", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: { resetWeekday: 4, resetHour: 12, format: "EEE" },
      rawValue: true,
    });
    expect(cell.text).toBe("Thu");
  });

  it("works without a snapshot in wall-clock mode (clock-only)", () => {
    const ctx = makeWidgetContext({ clock: frozenClock("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(ctx, {
      options: { format: "EEE D HH:mm" },
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("rawValue strips the default label in wall-clock mode", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weekLimitTimerWidget.render(makeCtx(snap), {
      options: { format: "EEE D HH:mm" },
      rawValue: true,
    });
    expect(cell.text.startsWith("week resets ")).toBe(false);
    expect(cell.text).toMatch(/^\w{3} \d{1,2} \d{2}:\d{2}$/);
  });
});

describe("reset widgets — host rate_limits.resets_at", () => {
  const NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);

  it("current-session-reset-timer counts down to the host five_hour.resets_at", () => {
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC + 119 * 60 } }),
      }),
      { options: {}, rawValue: false },
    );
    // Matches the host's "/usage" — e.g. "Resets in 1 hr 59 min".
    expect(cell.text).toBe("reset in 1h 59m");
  });

  it("current-session-reset-timer prefers the host value over the block anchor", () => {
    const anchor = FIXED_NOW_MS - 4 * HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now: FIXED_NOW_MS,
      blockAnchor: anchor,
    });
    // Block-anchor math alone would render "1h 0m"; the host says 30m.
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(snap, { stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC + 30 * 60 } }) }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("30m");
  });

  it("current-session-reset-timer clamps a stale (past) host reset to 0m", () => {
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC - 600 } }),
      }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("0m");
  });

  it("current-session-reset-timer falls back to the block anchor when rate_limits is absent", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now: anchor + 4 * HOUR_MS,
      blockAnchor: anchor,
    });
    const cell = currentSessionResetTimerWidget.render(makeCtx(snap, { stdin: stdinWith() }), {
      options: {},
      rawValue: true,
    });
    expect(cell.text).toBe("1h 0m");
  });

  it("week-limit-timer counts down to the host seven_day.resets_at", () => {
    const cell = weekLimitTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ sevenDay: { resetsAt: NOW_SEC + 2 * 86400 + 3600 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("reset in 2d 1h 0m");
  });

  it("current-session-reset-timer (HH:mm) renders the host five_hour wall-clock", () => {
    const resetsAt = Math.floor(Date.parse("2026-05-01T18:30:00Z") / 1000);
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ fiveHour: { resetsAt } }) }),
      { options: { format: "HH:mm", tz: "UTC" }, rawValue: false },
    );
    expect(cell.text).toBe("resets 18:30");
  });

  it("current-session-reset-timer (HH:mm) renders a past host reset verbatim (no clamp)", () => {
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC - 3600 } }),
      }),
      { options: { format: "HH:mm", tz: "UTC" }, rawValue: true },
    );
    // FIXED_NOW_MS is 03:00 UTC → one hour earlier is 02:00, shown as-is.
    expect(cell.text).toBe("02:00");
  });

  it("week-limit-timer (EEE D HH:mm) renders the host seven_day wall-clock", () => {
    const resetsAt = Math.floor(Date.parse("2026-05-07T12:00:00Z") / 1000);
    const cell = weekLimitTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ sevenDay: { resetsAt } }) }),
      { options: { format: "EEE D HH:mm", tz: "UTC" }, rawValue: true },
    );
    // 2026-05-07 is a Thursday — matches the host's "Resets Thu 12:00 PM".
    expect(cell.text).toBe("Thu 7 12:00");
  });

  it("week-limit-timer: the host value wins over configured resetWeekday/resetHour (wall-clock)", () => {
    const resetsAt = Math.floor(Date.parse("2026-05-07T12:00:00Z") / 1000);
    const cell = weekLimitTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ sevenDay: { resetsAt } }) }),
      { options: { resetWeekday: 0, resetHour: 0, format: "EEE D HH:mm", tz: "UTC" }, rawValue: true },
    );
    expect(cell.text).toBe("Thu 7 12:00");
  });
});

describe("reset widgets — huge / non-finite resets_at (bug-1)", () => {
  it("falls back to local anchor (no garbage) when resets_at * 1000 overflows to Infinity (e.g. 1e308)", () => {
    // 1e308 is finite so passes the first isFinite check in host-reset.ts,
    // but 1e308 * 1000 = Infinity — hostResetMs must guard the post-multiply
    // result and return undefined so the timer falls back to the local
    // block anchor, rendering a valid countdown instead of
    // "reset in Infinityd NaNh NaNm".
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ fiveHour: { resetsAt: 1e308 } }),
      }),
      { options: {}, rawValue: false },
    );
    // Falls back to local 5-hour block anchor → valid compact text, no garbage.
    expect(cell.hidden).toBeUndefined();
    expect(cell.text).not.toMatch(/Infinity|NaN/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("falls back to local anchor (no garbage) when resets_at is Infinity", () => {
    // Infinity fails the isFinite guard → hostResetMs returns undefined
    // → local fallback renders a valid countdown, not garbage.
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ fiveHour: { resetsAt: Infinity } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).not.toMatch(/Infinity|NaN/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("falls back to local anchor (no garbage) when resets_at is NaN", () => {
    // NaN fails the isFinite guard → hostResetMs returns undefined
    // → local fallback renders a valid countdown, not garbage.
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ fiveHour: { resetsAt: NaN } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).not.toMatch(/Infinity|NaN/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("falls back to local anchor when resets_at is -1e308 (post-multiply -Infinity)", () => {
    // -1e308 passes the first isFinite check but -1e308 * 1000 = -Infinity.
    // The post-multiply guard discards it → local block anchor is used
    // → valid countdown, no garbage.
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ fiveHour: { resetsAt: -1e308 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).not.toMatch(/Infinity|NaN/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("week-limit-timer: falls back to local anchor (no garbage) for huge seven_day.resets_at", () => {
    const cell = weekLimitTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ sevenDay: { resetsAt: 1e308 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).not.toMatch(/Infinity|NaN/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("falls back for a finite-but-huge resets_at beyond JS Date range (no sci-notation countdown)", () => {
    // 1e290 is finite and 1e290 * 1000 (= 1e293) is still finite, so the
    // isFinite guards pass — but it is far beyond Date's ±8.64e15 range and
    // produced "reset in 1.157…e+285d 14h 16m". The Date-range guard must
    // discard it → local anchor → a plain integer-day countdown.
    const cell = weekLimitTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ sevenDay: { resetsAt: 1e290 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBeUndefined();
    expect(cell.text).not.toMatch(/Infinity|NaN|e\+/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("does NOT crash on a wall-clock format with an out-of-Date-range resets_at", () => {
    // resets_at 9.99e14 s → 9.99e17 ms is out of Date range; the wall-clock
    // path built `new Date(ms)` = Invalid Date and threw in frozenClock
    // (exit 1, blank statusline). The Date-range guard must make it fall
    // back to the local anchor and render a valid HH:mm with no throw.
    expect(() =>
      currentSessionResetTimerWidget.render(
        makeCtx(undefined, {
          clock: frozenClock(new Date(FIXED_NOW_MS)),
          stdin: stdinWith({ fiveHour: { resetsAt: 9.99e14 } }),
        }),
        { options: { format: "HH:mm" }, rawValue: false },
      ),
    ).not.toThrow();
    const cell = currentSessionResetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ fiveHour: { resetsAt: 9.99e14 } }),
      }),
      { options: { format: "HH:mm" }, rawValue: false },
    );
    expect(cell.text).not.toMatch(/Infinity|NaN|Invalid/);
    expect(cell.text).toMatch(/\d\d:\d\d/);
  });
});

describe("session-weekly-usage — host % capped at 100 (bug-2)", () => {
  it("clamps a host session percentage of 150 to '100%'", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { usedPercentage: 150 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("100%");
  });

  it("clamps a host session percentage of 999 to '100%' (not '999%')", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { usedPercentage: 999 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("100%");
  });

  it("clamps a host weekly percentage of 150 to 'weekly 100%'", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ sevenDay: { usedPercentage: 150 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("weekly 100%");
  });

  it("does not clamp at 100 when both windows are within range", () => {
    const cell = sessionWeeklyUsageWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { usedPercentage: 52 },
          sevenDay: { usedPercentage: 33 },
        }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("52% · weekly 33%");
  });
});
