/**
 * Tests for the `added-dirs` widget (session family).
 *
 * Renders a count of extra workspace roots added via `/add-dir` from
 * `ctx.stdin.addedDirs.length`, e.g. `+2 dirs`. Hidden when the list is
 * absent or empty.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";
import { addedDirsWidget } from "./added-dirs.js";

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

describe("added-dirs widget", () => {
  it("hides when addedDirs is absent", () => {
    const cell = addedDirsWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when addedDirs is empty", () => {
    const cell = addedDirsWidget.render(makeCtx({ addedDirs: [] }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders '+1 dir' (singular) for one added dir", () => {
    const cell = addedDirsWidget.render(makeCtx({ addedDirs: ["/a"] }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("+1 dir");
  });

  it("renders '+2 dirs' (plural) for two added dirs", () => {
    const cell = addedDirsWidget.render(makeCtx({ addedDirs: ["/a", "/b"] }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("+2 dirs");
  });

  it("rawValue renders the bare count", () => {
    const cell = addedDirsWidget.render(makeCtx({ addedDirs: ["/a", "/b", "/c"] }), {
      options: {},
      rawValue: true,
    });
    expect(cell.text).toBe("3");
  });

  it("honours options.label when rawValue is false", () => {
    const cell = addedDirsWidget.render(makeCtx({ addedDirs: ["/a", "/b"] }), {
      options: { label: "roots:" },
      rawValue: false,
    });
    expect(cell.text).toBe("roots:+2 dirs");
  });
});
