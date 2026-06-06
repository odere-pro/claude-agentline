/**
 * Tests for the `clock` widget (session family).
 *
 * TDD — failing first, then implemented. Key assertions:
 *   - reads time-of-day through ctx.clock (never Date.now), so output is
 *     deterministic under frozenClock (gate-12);
 *   - default format is 24-hour HH:MM;
 *   - `format: "12h"` renders 12-hour with am/pm;
 *   - `seconds: true` appends :SS;
 *   - identical clock ⇒ identical text (determinism contract).
 *
 * Note: time is rendered in UTC so goldens stay byte-stable across CI
 * runners and time zones (the render-determinism contract — D-006).
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { clockWidget } from "./clock-widget.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(at: string): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock(at),
    env: {},
  };
}

describe("clock widget", () => {
  it("renders 24-hour HH:MM by default", () => {
    const cell = clockWidget.render(makeCtx("2026-01-15T09:05:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("09:05");
    expect(cell.hidden).toBeFalsy();
  });

  it("zero-pads hours and minutes", () => {
    const cell = clockWidget.render(makeCtx("2026-01-15T00:00:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("00:00");
  });

  it("renders 23:59 at end of day", () => {
    const cell = clockWidget.render(makeCtx("2026-01-15T23:59:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("23:59");
  });

  it("appends :SS when seconds option is true", () => {
    const cell = clockWidget.render(makeCtx("2026-01-15T09:05:07Z"), {
      options: { seconds: true },
      rawValue: false,
    });
    expect(cell.text).toBe("09:05:07");
  });

  it("renders 12-hour with lowercase am/pm when format is 12h", () => {
    const morning = clockWidget.render(makeCtx("2026-01-15T09:05:00Z"), {
      options: { format: "12h" },
      rawValue: false,
    });
    expect(morning.text).toBe("9:05am");

    const evening = clockWidget.render(makeCtx("2026-01-15T21:05:00Z"), {
      options: { format: "12h" },
      rawValue: false,
    });
    expect(evening.text).toBe("9:05pm");
  });

  it("renders 12:00pm at noon and 12:00am at midnight in 12h", () => {
    const noon = clockWidget.render(makeCtx("2026-01-15T12:00:00Z"), {
      options: { format: "12h" },
      rawValue: false,
    });
    expect(noon.text).toBe("12:00pm");

    const midnight = clockWidget.render(makeCtx("2026-01-15T00:00:00Z"), {
      options: { format: "12h" },
      rawValue: false,
    });
    expect(midnight.text).toBe("12:00am");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = clockWidget.render(makeCtx("2026-01-15T09:05:00Z"), {
      options: { label: "🕐 " },
      rawValue: false,
    });
    expect(cell.text).toBe("🕐 09:05");
  });

  it("rawValue suppresses the label", () => {
    const cell = clockWidget.render(makeCtx("2026-01-15T09:05:00Z"), {
      options: { label: "t:" },
      rawValue: true,
    });
    expect(cell.text).toBe("09:05");
  });

  it("is deterministic — identical frozen clock yields identical text", () => {
    const a = clockWidget.render(makeCtx("2026-01-15T13:37:00Z"), {
      options: {},
      rawValue: false,
    });
    const b = clockWidget.render(makeCtx("2026-01-15T13:37:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(a.text).toBe(b.text);
    expect(a.text).toBe("13:37");
  });
});
