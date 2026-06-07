/**
 * Tests for the `cost-efficiency` widget (tokens family).
 *
 * Renders the API-active ratio `apiDurationMs ÷ totalDurationMs` as a
 * percent — how much of the wall-clock was spent in API calls vs. local
 * work. Hides when either field is absent or totalDurationMs is 0 (no
 * divide-by-zero). Host scalars → no reset axis.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { costEfficiencyWidget } from "./cost-efficiency.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(stdinOverrides: Partial<StdinPayload> = {}): WidgetContext {
  return {
    stdin: { ...baseStdin, ...stdinOverrides },
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T00:00:00Z"),
    env: {},
  };
}

describe("cost-efficiency widget", () => {
  it("hides when the cost block is absent", () => {
    const cell = costEfficiencyWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when apiDurationMs is absent", () => {
    const cell = costEfficiencyWidget.render(makeCtx({ cost: { totalDurationMs: 10_000 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when totalDurationMs is absent", () => {
    const cell = costEfficiencyWidget.render(makeCtx({ cost: { apiDurationMs: 3000 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when totalDurationMs is 0 (no divide-by-zero)", () => {
    const cell = costEfficiencyWidget.render(
      makeCtx({ cost: { apiDurationMs: 3000, totalDurationMs: 0 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders the API-active ratio as a percent", () => {
    const cell = costEfficiencyWidget.render(
      makeCtx({ cost: { apiDurationMs: 7000, totalDurationMs: 10_000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("70%");
  });

  it("rounds to the nearest percent", () => {
    const cell = costEfficiencyWidget.render(
      makeCtx({ cost: { apiDurationMs: 1, totalDurationMs: 3 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("33%");
  });

  it("caps at 100% when the host reports api time exceeding wall time", () => {
    const cell = costEfficiencyWidget.render(
      makeCtx({ cost: { apiDurationMs: 12_000, totalDurationMs: 10_000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("100%");
  });

  it("rawValue renders the bare number without the percent sign", () => {
    const cell = costEfficiencyWidget.render(
      makeCtx({ cost: { apiDurationMs: 7000, totalDurationMs: 10_000 } }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("70");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = costEfficiencyWidget.render(
      makeCtx({ cost: { apiDurationMs: 7000, totalDurationMs: 10_000 } }),
      { options: { label: "eff:" }, rawValue: false },
    );
    expect(cell.text).toBe("eff:70%");
  });
});
