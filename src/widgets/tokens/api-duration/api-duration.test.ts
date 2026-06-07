/**
 * Tests for the `api-duration` widget (tokens family).
 *
 * Renders time spent waiting on the API from `cost.apiDurationMs`.
 * Default: absolute (`2.3s`, `1m 5s`). `percent: true` shows the share
 * of wall-clock (`apiDurationMs ÷ totalDurationMs`), hidden when the
 * wall scalar is absent or 0. Hidden when apiDurationMs is absent.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { apiDurationWidget } from "./api-duration.js";

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

describe("api-duration widget", () => {
  it("hides when the cost block is absent", () => {
    const cell = apiDurationWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when apiDurationMs is absent", () => {
    const cell = apiDurationWidget.render(makeCtx({ cost: { totalDurationMs: 10_000 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders a sub-minute api duration", () => {
    const cell = apiDurationWidget.render(makeCtx({ cost: { apiDurationMs: 2300 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("2.3s");
  });

  it("renders a minute-scale api duration", () => {
    const cell = apiDurationWidget.render(makeCtx({ cost: { apiDurationMs: 65_000 } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("1m 5s");
  });

  it("renders a percent of wall-clock when percent option is set", () => {
    const cell = apiDurationWidget.render(
      makeCtx({ cost: { apiDurationMs: 3000, totalDurationMs: 10_000 } }),
      { options: { percent: true }, rawValue: false },
    );
    expect(cell.text).toBe("30%");
  });

  it("hides under percent mode when totalDurationMs is absent", () => {
    const cell = apiDurationWidget.render(makeCtx({ cost: { apiDurationMs: 3000 } }), {
      options: { percent: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides under percent mode when totalDurationMs is 0 (no divide-by-zero)", () => {
    const cell = apiDurationWidget.render(
      makeCtx({ cost: { apiDurationMs: 3000, totalDurationMs: 0 } }),
      { options: { percent: true }, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("honours options.label when rawValue is false", () => {
    const cell = apiDurationWidget.render(makeCtx({ cost: { apiDurationMs: 2300 } }), {
      options: { label: "api:" },
      rawValue: false,
    });
    expect(cell.text).toBe("api:2.3s");
  });
});
