/**
 * Tests for the `vim-mode` widget (session family).
 *
 * TDD — failing first, then implemented. Key assertions:
 *   - renders ctx.stdin.vimMode (already parsed by the adapter);
 *   - hides when vimMode is absent (vim mode off → nothing to show);
 *   - upper-cases the mode to the familiar vim indicator (NORMAL/INSERT/…)
 *     while passing an unknown future mode through unchanged-but-upper.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { vimModeWidget } from "./vim-mode.js";

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

describe("vim-mode widget", () => {
  it("hides when stdin.vimMode is absent", () => {
    const cell = vimModeWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when stdin.vimMode is an empty string", () => {
    const cell = vimModeWidget.render(makeCtx({ vimMode: "" }), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders NORMAL for the normal mode", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "normal" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("NORMAL");
    expect(cell.hidden).toBeFalsy();
  });

  it("renders INSERT for the insert mode", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "insert" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("INSERT");
  });

  it("upper-cases an unknown future mode rather than hiding it", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "operator-pending" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("OPERATOR-PENDING");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "visual" }),
      { options: { label: "vim:" }, rawValue: false },
    );
    expect(cell.text).toBe("vim:VISUAL");
  });

  it("rawValue suppresses the label", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "visual" }),
      { options: { label: "vim:" }, rawValue: true },
    );
    expect(cell.text).toBe("VISUAL");
  });
});
