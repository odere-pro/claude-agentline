import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";

import { clockWidget, formatClock } from "./clock.js";
import { uptimeBlockWidget, uptimeSessionWidget } from "./uptime.js";
import { registerTimeWidgets, TIME_WIDGETS } from "./index.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(
  at: string,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock(at),
    env: {},
    ...overrides,
  };
}

describe("registerTimeWidgets", () => {
  it("ships exactly three widgets in sorted order", () => {
    const r = new WidgetRegistry();
    registerTimeWidgets(r);
    expect(r.size()).toBe(3);
    expect(r.list()).toEqual(["clock", "uptime-block", "uptime-session"]);
    expect(Object.isFrozen(TIME_WIDGETS)).toBe(true);
  });
});

describe("formatClock", () => {
  const clock = frozenClock("2026-05-01T14:32:05Z");

  it("default HH:mm via the clock widget", () => {
    const cell = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("14:32");
  });

  it("HH:mm:ss in UTC", () => {
    expect(formatClock(clock, "HH:mm:ss", "UTC")).toBe("14:32:05");
  });

  it("12-hour with am/pm", () => {
    expect(formatClock(clock, "h:mma", "UTC")).toBe("2:32pm");
  });

  it("am/pm for early hours", () => {
    expect(formatClock(frozenClock("2026-05-01T03:05:00Z"), "h:mmA", "UTC")).toBe("3:05AM");
  });

  it("midnight maps to h=12", () => {
    expect(formatClock(frozenClock("2026-05-01T00:00:00Z"), "h:mm", "UTC")).toBe("12:00");
  });

  it("preserves literal characters", () => {
    expect(formatClock(clock, "[HH]:[mm]", "UTC")).toBe("[14]:[32]");
  });
});

describe("uptime widgets", () => {
  const sessionStart = Date.parse("2026-05-01T00:00:00Z");

  function snapshotAt(now: number, anchor = sessionStart): TokensSnapshot {
    return Object.freeze({
      events: [],
      now,
      sessionStart,
      blockAnchor: anchor,
      contextWindow: 200_000,
      pricingVersion: "test",
    });
  }

  it("uptime-session shows the elapsed time", () => {
    const now = sessionStart + 3 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const cell = uptimeSessionWidget.render(
      makeCtx(new Date(now).toISOString(), { tokens: snapshotAt(now) }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("3h30m");
  });

  it("uptime-session hides without a snapshot", () => {
    const cell = uptimeSessionWidget.render(makeCtx("2026-05-01T00:30:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("uptime-block resets at the 5-h boundary", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 6 * 60 * 60 * 1000; // 1h into the second block
    const cell = uptimeBlockWidget.render(
      makeCtx(new Date(now).toISOString(), { tokens: snapshotAt(now, anchor) }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("1h0m");
  });

  it("uptime-block falls back to 0m without a snapshot", () => {
    const cell = uptimeBlockWidget.render(makeCtx("2026-05-01T00:00:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("0m");
  });

  it("clock format works for uptime widgets", () => {
    const now = sessionStart + 90 * 60 * 1000;
    const cell = uptimeSessionWidget.render(
      makeCtx(new Date(now).toISOString(), { tokens: snapshotAt(now) }),
      { options: { format: "clock" }, rawValue: false },
    );
    expect(cell.text).toBe("01:30:00");
  });
});
