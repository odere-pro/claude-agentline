/**
 * Tests for the `context-200k-flag` widget (context family).
 *
 * Shows a badge when `ctx.stdin.exceeds200kTokens` is true — the prompt
 * has crossed the 200k-token threshold (long-context pricing/behaviour).
 * Hidden when false or absent.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { context200kFlagWidget } from "./context-200k-flag.js";

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

describe("context-200k-flag widget", () => {
  it("hides when exceeds200kTokens is absent", () => {
    const cell = context200kFlagWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when exceeds200kTokens is false", () => {
    const cell = context200kFlagWidget.render(makeCtx({ exceeds200kTokens: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the badge when exceeds200kTokens is true", () => {
    const cell = context200kFlagWidget.render(makeCtx({ exceeds200kTokens: true }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe(">200k");
    expect(cell.hidden).toBeFalsy();
  });

  it("honours a custom label when rawValue is false", () => {
    const cell = context200kFlagWidget.render(makeCtx({ exceeds200kTokens: true }), {
      options: { label: "long: " },
      rawValue: false,
    });
    expect(cell.text).toBe("long: >200k");
  });

  it("rawValue suppresses the label", () => {
    const cell = context200kFlagWidget.render(makeCtx({ exceeds200kTokens: true }), {
      options: { label: "long: " },
      rawValue: true,
    });
    expect(cell.text).toBe(">200k");
  });
});
