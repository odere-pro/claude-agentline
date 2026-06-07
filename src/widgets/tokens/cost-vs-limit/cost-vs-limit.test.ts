/**
 * Tests for the `cost-vs-limit` widget (tokens family).
 *
 * Shows session spend against a user-configured budget, e.g. `$1.20/$5`.
 * Data: `cost.totalUsd` (host scalar) + a per-widget `budget` option (USD,
 * a positive number). No reset axis. Over budget → a `danger`-role signal
 * cell (theme-driven, no hardcoded colour).
 *
 * Hides when totalUsd is absent, or budget is missing / non-positive /
 * not a number.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { costVsLimitWidget } from "./cost-vs-limit.js";

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

describe("cost-vs-limit widget", () => {
  it("hides when the cost block is absent", () => {
    const cell = costVsLimitWidget.render(makeCtx(), { options: { budget: 5 }, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when totalUsd is absent", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalDurationMs: 1000 } }), {
      options: { budget: 5 },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when budget is not configured", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when budget is zero or negative (invalid)", () => {
    for (const budget of [0, -5]) {
      const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
        options: { budget },
        rawValue: false,
      });
      expect(cell.hidden, `budget ${budget}`).toBe(true);
    }
  });

  it("hides when budget is not a number", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: { budget: "five" as unknown as number },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders spend/budget under budget", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: { budget: 5 },
      rawValue: false,
    });
    expect(cell.text).toBe("$1.20/$5");
    expect(cell.hidden).toBeFalsy();
  });

  it("does not signal danger while under budget", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: { budget: 5 },
      rawValue: false,
    });
    expect(cell.signal).toBeFalsy();
  });

  it("signals danger (theme role) when over budget", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 6 } }), {
      options: { budget: 5 },
      rawValue: false,
    });
    expect(cell.text).toBe("$6/$5");
    expect(cell.signal).toBe(true);
    expect(cell.fg).toBeTruthy();
  });

  it("treats exactly-at-budget as over (signals at 100%)", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 5 } }), {
      options: { budget: 5 },
      rawValue: false,
    });
    expect(cell.signal).toBe(true);
  });

  it("honours options.label when rawValue is false", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: { budget: 5, label: "budget:" },
      rawValue: false,
    });
    expect(cell.text).toBe("budget:$1.20/$5");
  });

  it("rawValue renders the bare spend/budget without label", () => {
    const cell = costVsLimitWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: { budget: 5, label: "budget:" },
      rawValue: true,
    });
    expect(cell.text).toBe("$1.20/$5");
  });
});
