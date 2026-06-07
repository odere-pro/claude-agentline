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
import { resetTimerWidget } from "./reset-timer.js";
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
  it("ships exactly two widgets in sorted order", () => {
    const r = new WidgetRegistry();
    registerRateLimitWidgets(r);
    expect(r.size()).toBe(2);
    expect(r.list()).toEqual(["reset-timer", "session-weekly-usage"]);
    expect(Object.isFrozen(RATE_LIMIT_WIDGETS)).toBe(true);
    expect(RATE_LIMIT_WIDGETS).toHaveLength(2);
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

describe("reset-timer widget — countdown (both windows)", () => {
  const NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);

  it("renders both windows: 'reset in <session> · weekly <weekly>'", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { resetsAt: NOW_SEC + 90 * 60 },
          sevenDay: { resetsAt: NOW_SEC + 3 * 86400 + 4 * 3600 },
        }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("reset in 1h 30m · weekly 3d 4h 0m");
  });

  it("rawValue strips the default 'reset in ' label", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { resetsAt: NOW_SEC + 90 * 60 },
          sevenDay: { resetsAt: NOW_SEC + 3 * 86400 + 4 * 3600 },
        }),
      }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("1h 30m · weekly 3d 4h 0m");
  });

  it("session-only when the host omits the weekly window and no anchor is pinned", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC + 90 * 60 } }),
      }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("1h 30m");
  });

  it("clamps a stale (past) host reset to 0m per window", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { resetsAt: NOW_SEC - 600 },
          sevenDay: { resetsAt: NOW_SEC - 600 },
        }),
      }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("0m · weekly 0m");
  });

  it("falls back to the local block anchor for the session window when rate_limits is absent", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now: anchor + 4 * HOUR_MS,
      blockAnchor: anchor,
    });
    const cell = resetTimerWidget.render(makeCtx(snap, { stdin: stdinWith() }), {
      options: {},
      rawValue: true,
    });
    // Session resolves from the block anchor; weekly drops (no host value, no pin).
    expect(cell.text).toBe("1h 0m");
  });

  it("clock format renders HH:MM:SS countdowns for both windows", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({
          fiveHour: { resetsAt: NOW_SEC + 60 * 60 },
          sevenDay: { resetsAt: NOW_SEC + 25 * 3600 },
        }),
      }),
      { options: { format: "clock" }, rawValue: true },
    );
    expect(cell.text).toBe("01:00:00 · weekly 25:00:00");
  });

  it("respects a custom label override", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC + 90 * 60 } }),
      }),
      { options: { label: "resets in: " }, rawValue: false },
    );
    expect(cell.text).toMatch(/^resets in: /);
  });

  it("hidden when neither window resolves", () => {
    const cell = resetTimerWidget.render(makeCtx(undefined, { stdin: stdinWith() }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });
});

describe("reset-timer widget — wall-clock (at-* variants, both windows)", () => {
  const NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);

  it("HH:mm renders the absolute reset of both windows with the 'resets ' label", () => {
    const sessionAt = Math.floor(Date.parse("2026-05-01T18:30:00Z") / 1000);
    const weeklyAt = Math.floor(Date.parse("2026-05-07T12:00:00Z") / 1000);
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        stdin: stdinWith({ fiveHour: { resetsAt: sessionAt }, sevenDay: { resetsAt: weeklyAt } }),
      }),
      { options: { format: "HH:mm", tz: "UTC" }, rawValue: false },
    );
    // Session uses HH:mm; the weekly window keeps its day default (EEE D HH:mm).
    expect(cell.text).toBe("resets 18:30 · weekly Thu 7 12:00");
  });

  it("rawValue strips the label in wall-clock mode", () => {
    const sessionAt = Math.floor(Date.parse("2026-05-01T18:30:00Z") / 1000);
    const cell = resetTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ fiveHour: { resetsAt: sessionAt } }) }),
      { options: { format: "HH:mm", tz: "UTC" }, rawValue: true },
    );
    expect(cell.text).toBe("18:30");
  });

  it("h:mma renders 12-hour time with am/pm", () => {
    const sessionAt = Math.floor(Date.parse("2026-05-01T18:00:00Z") / 1000);
    const cell = resetTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ fiveHour: { resetsAt: sessionAt } }) }),
      { options: { format: "h:mma", tz: "UTC" }, rawValue: true },
    );
    // An explicit non-default token applies to both windows.
    expect(cell.text).toBe("6:00pm");
  });

  it("renders a past host reset verbatim in wall-clock mode (no clamp)", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ fiveHour: { resetsAt: NOW_SEC - 3600 } }) }),
      { options: { format: "HH:mm", tz: "UTC" }, rawValue: true },
    );
    expect(cell.text).toBe("02:00");
  });

  it("the host value wins over configured resetWeekday/resetHour (weekly wall-clock)", () => {
    const weeklyAt = Math.floor(Date.parse("2026-05-07T12:00:00Z") / 1000);
    const cell = resetTimerWidget.render(
      makeCtx(undefined, { stdin: stdinWith({ sevenDay: { resetsAt: weeklyAt } }) }),
      {
        options: { resetWeekday: 0, resetHour: 0, format: "EEE D HH:mm", tz: "UTC" },
        rawValue: true,
      },
    );
    expect(cell.text).toBe("weekly Thu 7 12:00");
  });
});

describe("reset-timer widget — huge / non-finite resets_at (bug-1)", () => {
  it("falls back to local anchor (no garbage) when resets_at * 1000 overflows to Infinity (1e308)", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ fiveHour: { resetsAt: 1e308 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBeUndefined();
    expect(cell.text).not.toMatch(/Infinity|NaN/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("falls back to local anchor when resets_at is Infinity / NaN", () => {
    for (const bad of [Infinity, NaN]) {
      const cell = resetTimerWidget.render(
        makeCtx(undefined, {
          clock: frozenClock(new Date(FIXED_NOW_MS)),
          stdin: stdinWith({ fiveHour: { resetsAt: bad } }),
        }),
        { options: {}, rawValue: false },
      );
      expect(cell.text).not.toMatch(/Infinity|NaN/);
      expect(cell.text).toMatch(/reset in \d/);
    }
  });

  it("falls back for a finite-but-huge weekly resets_at beyond JS Date range (no sci-notation)", () => {
    const cell = resetTimerWidget.render(
      makeCtx(undefined, {
        clock: frozenClock(new Date(FIXED_NOW_MS)),
        stdin: stdinWith({ sevenDay: { resetsAt: 1e290 }, fiveHour: { resetsAt: 1e290 } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBeUndefined();
    expect(cell.text).not.toMatch(/Infinity|NaN|e\+/);
    expect(cell.text).toMatch(/reset in \d/);
  });

  it("does NOT crash on a wall-clock format with an out-of-Date-range resets_at", () => {
    expect(() =>
      resetTimerWidget.render(
        makeCtx(undefined, {
          clock: frozenClock(new Date(FIXED_NOW_MS)),
          stdin: stdinWith({ fiveHour: { resetsAt: 9.99e14 } }),
        }),
        { options: { format: "HH:mm" }, rawValue: false },
      ),
    ).not.toThrow();
    const cell = resetTimerWidget.render(
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
