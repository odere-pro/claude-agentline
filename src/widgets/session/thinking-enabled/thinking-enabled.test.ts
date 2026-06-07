/**
 * Tests for the `thinking-enabled` widget (session family).
 *
 * Renders an on/off indicator from `ctx.stdin.thinkingEnabled`.
 * Complements `thinking-effort` (which level): this is the on/off switch.
 * Hidden when the field is absent (host didn't report it).
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { thinkingEnabledWidget } from "./thinking-enabled.js";

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

describe("thinking-enabled widget", () => {
  it("hides when thinkingEnabled is absent", () => {
    const cell = thinkingEnabledWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("renders 'thinking' when enabled", () => {
    const cell = thinkingEnabledWidget.render(makeCtx({ thinkingEnabled: true }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("thinking");
    expect(cell.hidden).toBeFalsy();
  });

  it("hides when thinking is disabled (false) by default", () => {
    const cell = thinkingEnabledWidget.render(makeCtx({ thinkingEnabled: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("shows the off state when showOff is true", () => {
    const cell = thinkingEnabledWidget.render(makeCtx({ thinkingEnabled: false }), {
      options: { showOff: true },
      rawValue: false,
    });
    expect(cell.text).toBe("no-thinking");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = thinkingEnabledWidget.render(makeCtx({ thinkingEnabled: true }), {
      options: { label: "🧠 " },
      rawValue: false,
    });
    expect(cell.text).toBe("🧠 thinking");
  });
});
