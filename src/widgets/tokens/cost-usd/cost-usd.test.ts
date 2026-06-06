/**
 * Tests for the `cost-usd` widget (tokens family).
 *
 * TDD — failing first, then implemented. Tests assert:
 *   - renders formatted USD from ctx.stdin.cost.totalUsd;
 *   - hides when the cost block is absent;
 *   - hides when totalUsd is absent from an otherwise-present cost block;
 *   - is pure — no clock, no I/O.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { costUsdWidget } from "./cost-usd.js";

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

describe("cost-usd widget", () => {
  it("hides when stdin.cost is absent", () => {
    const cell = costUsdWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when stdin.cost.totalUsd is absent", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalDurationMs: 5000 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders $0.00 for a zero cost", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalUsd: 0 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("$0");
    expect(cell.hidden).toBeFalsy();
  });

  it("renders $1.23 for a typical cost", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalUsd: 1.23 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("$1.23");
  });

  it("renders $12 for a whole-dollar cost (no unnecessary decimal)", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalUsd: 12 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("$12");
  });

  it("renders $1.2k for a large cost", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalUsd: 1200 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("$1.2k");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalUsd: 0.5 } }),
      { options: { label: "cost:" }, rawValue: false },
    );
    expect(cell.text).toBe("cost:$0.50");
  });

  it("rawValue suppresses the label", () => {
    const cell = costUsdWidget.render(
      makeCtx({ cost: { totalUsd: 0.5 } }),
      { options: { label: "cost:" }, rawValue: true },
    );
    expect(cell.text).toBe("$0.50");
  });

  it("is pure — the frozen clock does not influence output (no ctx.clock usage)", () => {
    const clock1 = frozenClock("2026-01-01T00:00:00Z");
    const clock2 = frozenClock("2030-12-31T23:59:59Z");
    const stdinOverrides = { cost: { totalUsd: 3.45 } };
    const ctx1 = { ...makeCtx(stdinOverrides), clock: clock1 };
    const ctx2 = { ...makeCtx(stdinOverrides), clock: clock2 };
    expect(costUsdWidget.render(ctx1, { options: {}, rawValue: false }).text).toBe(
      costUsdWidget.render(ctx2, { options: {}, rawValue: false }).text,
    );
  });
});
