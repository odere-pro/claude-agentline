/**
 * Tests for the `cost-burn-rate` widget (tokens family).
 *
 * Derives a spend rate `$/hr` from the host cost block:
 *   totalUsd ÷ (totalDurationMs / 3.6e6).
 * Hides when totalUsd or totalDurationMs is absent, or duration is 0
 * (no divide-by-zero). Host scalars → no reset axis.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { costBurnRateWidget } from "./cost-burn-rate.js";

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

const HOUR_MS = 3_600_000;

describe("cost-burn-rate widget", () => {
  it("hides when the cost block is absent", () => {
    const cell = costBurnRateWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when totalUsd is absent", () => {
    const cell = costBurnRateWidget.render(makeCtx({ cost: { totalDurationMs: HOUR_MS } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when totalDurationMs is absent", () => {
    const cell = costBurnRateWidget.render(makeCtx({ cost: { totalUsd: 1.2 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when totalDurationMs is 0 (no divide-by-zero)", () => {
    const cell = costBurnRateWidget.render(
      makeCtx({ cost: { totalUsd: 1.2, totalDurationMs: 0 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders $/hr for a full hour of spend", () => {
    const cell = costBurnRateWidget.render(
      makeCtx({ cost: { totalUsd: 1.2, totalDurationMs: HOUR_MS } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("$1.20/hr");
  });

  it("extrapolates a half-hour of spend to an hourly rate", () => {
    const cell = costBurnRateWidget.render(
      makeCtx({ cost: { totalUsd: 0.6, totalDurationMs: HOUR_MS / 2 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("$1.20/hr");
  });

  it("rawValue renders the bare rate without label or suffix", () => {
    const cell = costBurnRateWidget.render(
      makeCtx({ cost: { totalUsd: 1.2, totalDurationMs: HOUR_MS } }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("$1.20");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = costBurnRateWidget.render(
      makeCtx({ cost: { totalUsd: 1.2, totalDurationMs: HOUR_MS } }),
      { options: { label: "burn:" }, rawValue: false },
    );
    expect(cell.text).toBe("burn:$1.20/hr");
  });
});
