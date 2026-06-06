/**
 * Tests for the `session-duration` widget (session family).
 *
 * TDD — failing first, then implemented. Key assertions:
 *   - renders ctx.stdin.cost.totalDurationMs directly (not clock-based);
 *   - hides when cost block or totalDurationMs is absent;
 *   - never uses ctx.clock — proved by rendering with a frozen clock far
 *     from the duration and asserting the output reflects the duration, not
 *     elapsed time.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { sessionDurationWidget } from "./session-duration.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(stdinOverrides: Partial<StdinPayload> = {}): WidgetContext {
  return {
    stdin: { ...baseStdin, ...stdinOverrides },
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T12:00:00Z"),
    env: {},
  };
}

describe("session-duration widget", () => {
  it("hides when stdin.cost is absent", () => {
    const cell = sessionDurationWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when totalDurationMs is absent from an otherwise-present cost block", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalUsd: 0.5 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders '0m 0s' for zero duration", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 0 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("0m 0s");
    expect(cell.hidden).toBeFalsy();
  });

  it("renders '1m 30s' for 90 seconds", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 90_000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("1m 30s");
  });

  it("renders '12m 30s' for 12.5 minutes", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 12 * 60_000 + 30_000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("12m 30s");
  });

  it("renders '1h 5m' for durations >= 60 minutes (h+m format, seconds dropped)", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 65 * 60_000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("1h 5m");
  });

  it("renders '2h 0m' for exactly 2 hours", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 2 * 60 * 60_000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("2h 0m");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 90_000 } }),
      { options: { label: "dur:" }, rawValue: false },
    );
    expect(cell.text).toBe("dur:1m 30s");
  });

  it("rawValue suppresses the label", () => {
    const cell = sessionDurationWidget.render(
      makeCtx({ cost: { totalDurationMs: 90_000 } }),
      { options: { label: "dur:" }, rawValue: true },
    );
    expect(cell.text).toBe("1m 30s");
  });

  it("uses totalDurationMs directly — frozen clock far from duration does not affect output", () => {
    // Duration is 2 minutes (120 s). Clock is set to epoch (Jan 1, 1970) — if
    // any now-start logic were used it would produce a wildly different number.
    const durationMs = 2 * 60_000;
    const distantClock = frozenClock("1970-01-01T00:00:00Z");
    const futureClock = frozenClock("2099-12-31T23:59:59Z");
    const stdinOverrides = { cost: { totalDurationMs: durationMs } };
    const ctxDistant = { ...makeCtx(stdinOverrides), clock: distantClock };
    const ctxFuture = { ...makeCtx(stdinOverrides), clock: futureClock };

    const textDistant = sessionDurationWidget.render(ctxDistant, { options: {}, rawValue: false }).text;
    const textFuture = sessionDurationWidget.render(ctxFuture, { options: {}, rawValue: false }).text;

    // Both must render the same value (the actual duration, not elapsed time)
    expect(textDistant).toBe("2m 0s");
    expect(textFuture).toBe("2m 0s");
  });
});
