import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";

import { clockWidget, formatClock } from "./clock.js";
import { registerTimeWidgets, TIME_WIDGETS } from "./index.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(at: string, overrides: Partial<WidgetContext> = {}): WidgetContext {
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

  it("HH:mm is the default format", () => {
    expect(formatClock(clock, "HH:mm", "UTC")).toBe("14:32");
  });

  it("HH:mm:ss includes seconds", () => {
    expect(formatClock(clock, "HH:mm:ss", "UTC")).toBe("14:32:05");
  });

  it("H omits the leading zero for hour", () => {
    expect(formatClock(clock, "H:mm", "UTC")).toBe("14:32");
  });

  it("h uses 12-hour format (no am/pm)", () => {
    expect(formatClock(clock, "h:mm", "UTC")).toBe("2:32");
  });

  it("h:mma appends lowercase am/pm", () => {
    expect(formatClock(clock, "h:mma", "UTC")).toBe("2:32pm");
  });

  it("h:mmA appends uppercase AM/PM", () => {
    expect(formatClock(clock, "h:mmA", "UTC")).toBe("2:32PM");
  });

  it("midnight maps h=12 (not 0)", () => {
    const midnight = frozenClock("2026-05-01T00:00:00Z");
    expect(formatClock(midnight, "h:mm", "UTC")).toBe("12:00");
  });

  it("early morning renders correctly in 12-hour format", () => {
    const early = frozenClock("2026-05-01T03:05:00Z");
    expect(formatClock(early, "h:mmA", "UTC")).toBe("3:05AM");
  });

  it("brackets in the format string are kept as literal characters", () => {
    // The brackets [ ] are treated as literal text; tokens inside are still substituted
    expect(formatClock(clock, "[HH]:[mm]", "UTC")).toBe("[14]:[32]");
  });

  it("hh pads 12-hour to two digits", () => {
    const early = frozenClock("2026-05-01T03:05:00Z");
    expect(formatClock(early, "hh:mm", "UTC")).toBe("03:05");
  });
});

describe("clock widget", () => {
  it("renders default HH:mm in local time when tz omitted", () => {
    /*
     * Pin process.env.TZ for the duration of the assertion so "local"
     * time is deterministic. Without this, the assertion below would
     * be host-TZ dependent and the test would have to fall back to a
     * shape-only regex check that never fails.
     */
    const prevTz = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      const cell = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
        options: {},
        rawValue: false,
      });
      expect(cell.text).toBe("14:32");
    } finally {
      if (prevTz === undefined) delete process.env.TZ;
      else process.env.TZ = prevTz;
    }
  });

  it("renders with UTC timezone via options.tz", () => {
    const cell = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("14:32");
  });

  it("renders custom format via options.format", () => {
    const cell = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { format: "HH:mm:ss", tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("14:32:05");
  });

  it("renders custom label when set", () => {
    const cell = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { label: "time:", tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("time:14:32");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { label: "time:", tz: "UTC" },
      rawValue: false,
    });
    const noLabel = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { label: "time:", tz: "UTC" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("time:14:32");
    expect(noLabel.text).toBe("14:32");
  });

  it("falls back to default format for empty options.format", () => {
    const cell = clockWidget.render(makeCtx("2026-05-01T14:32:05Z"), {
      options: { format: "", tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("14:32");
  });
});
