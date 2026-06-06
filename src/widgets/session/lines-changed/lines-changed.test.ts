/**
 * Tests for the `lines-changed` widget (session family).
 *
 * TDD — failing first, then implemented. Key assertions:
 *   - renders "+<added> −<removed>" from cost.linesAdded / cost.linesRemoved;
 *   - hides when both fields are absent;
 *   - renders whichever field is present when only one is;
 *   - is pure — no clock, no I/O.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { linesChangedWidget } from "./lines-changed.js";

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

describe("lines-changed widget", () => {
  it("hides when stdin.cost is absent", () => {
    const cell = linesChangedWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when both linesAdded and linesRemoved are absent", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { totalUsd: 0.5 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders '+156 −23' when both fields are present", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { linesAdded: 156, linesRemoved: 23 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("+156 −23");
    expect(cell.hidden).toBeFalsy();
  });

  it("renders only the added segment when linesRemoved is absent", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { linesAdded: 100 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("+100");
  });

  it("renders only the removed segment when linesAdded is absent", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { linesRemoved: 50 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("−50");
  });

  it("renders '+0 −0' when both are zero", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { linesAdded: 0, linesRemoved: 0 } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("+0 −0");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { linesAdded: 10, linesRemoved: 5 } }),
      { options: { label: "lines:" }, rawValue: false },
    );
    expect(cell.text).toBe("lines:+10 −5");
  });

  it("rawValue suppresses the label", () => {
    const cell = linesChangedWidget.render(
      makeCtx({ cost: { linesAdded: 10, linesRemoved: 5 } }),
      { options: { label: "lines:" }, rawValue: true },
    );
    expect(cell.text).toBe("+10 −5");
  });

  it("is pure — clock does not influence output", () => {
    const stdinOverrides = { cost: { linesAdded: 10, linesRemoved: 5 } };
    const clock1 = frozenClock("1970-01-01T00:00:00Z");
    const clock2 = frozenClock("2099-12-31T23:59:59Z");
    const ctx1 = { ...makeCtx(stdinOverrides), clock: clock1 };
    const ctx2 = { ...makeCtx(stdinOverrides), clock: clock2 };
    expect(linesChangedWidget.render(ctx1, { options: {}, rawValue: false }).text).toBe(
      linesChangedWidget.render(ctx2, { options: {}, rawValue: false }).text,
    );
  });
});
