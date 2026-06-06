/**
 * Tests for the `output-style` widget (session family).
 *
 * TDD — failing first, then implemented. Key assertions:
 *   - renders ctx.stdin.outputStyle (already parsed by the adapter);
 *   - hides when outputStyle is absent;
 *   - hides the unremarkable "default" style by default, but shows it
 *     when `showDefault: true` (keeps the statusline quiet in the common
 *     case while staying explicit when asked).
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { outputStyleWidget } from "./output-style.js";

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

describe("output-style widget", () => {
  it("hides when stdin.outputStyle is absent", () => {
    const cell = outputStyleWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("renders a non-default style", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "explanatory" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("explanatory");
    expect(cell.hidden).toBeFalsy();
  });

  it("hides the 'default' style by default", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "default" }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("shows 'default' when showDefault option is true", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "default" }),
      { options: { showDefault: true }, rawValue: false },
    );
    expect(cell.text).toBe("default");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "learning" }),
      { options: { label: "style:" }, rawValue: false },
    );
    expect(cell.text).toBe("style:learning");
  });

  it("rawValue suppresses the label", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "learning" }),
      { options: { label: "style:" }, rawValue: true },
    );
    expect(cell.text).toBe("learning");
  });
});
