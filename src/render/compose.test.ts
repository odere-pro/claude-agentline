import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/index.js";
import type { GlobalConfig, PowerlineConfig } from "../config/types.js";
import type { Cell } from "../widgets/cell.js";

import { composeLines, type ComposeOptions } from "./compose.js";

const cell = (overrides: Partial<Cell>): Cell => ({ text: "", ...overrides });

const baseGlobal: GlobalConfig = DEFAULT_CONFIG.global;
const baseOptions = (
  overrides: Partial<ComposeOptions> = {},
  pwl: Partial<PowerlineConfig> = {},
): ComposeOptions => ({
  global: baseGlobal,
  powerline: { ...DEFAULT_CONFIG.powerline, ...pwl },
  theme: null,
  width: 40,
  glyphSupport: "nerd",
  ...overrides,
});

describe("composeLines (plain mode)", () => {
  it("joins cells with global separator + padding", () => {
    const out = composeLines([[cell({ text: "a" }), cell({ text: "b" })]], baseOptions());
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text).toContain("a");
    expect(text).toContain("b");
    // separator may be configured; we assert structural shape only
    expect(text.startsWith("a")).toBe(true);
    expect(text.endsWith("b")).toBe(true);
  });

  it("respects merged='merge' (single-space, no separator)", () => {
    const out = composeLines(
      [[cell({ text: "a" }), cell({ text: "b", merged: "merge" })]],
      baseOptions(),
    );
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text).toBe("a b");
  });

  it("respects merged='merge-no-padding'", () => {
    const out = composeLines(
      [[cell({ text: "a" }), cell({ text: "b", merged: "merge-no-padding" })]],
      baseOptions(),
    );
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text).toBe("ab");
  });

  it("drops hidden cells from output", () => {
    const out = composeLines(
      [[cell({ text: "a" }), cell({ text: "b", hidden: true }), cell({ text: "c" })]],
      baseOptions(),
    );
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text).toContain("a");
    expect(text).toContain("c");
    expect(text).not.toContain("b");
  });

  it("expands flex-separator to fill remaining width", () => {
    const out = composeLines(
      [
        [
          cell({ text: "L" }),
          cell({ text: " ", flex: true, merged: "merge-no-padding" }),
          cell({ text: "R", merged: "merge-no-padding" }),
        ],
      ],
      baseOptions({ width: 20 }),
    );
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text.length).toBe(20);
    expect(text.startsWith("L")).toBe(true);
    expect(text.endsWith("R")).toBe(true);
    // Middle should be all the fill character (default ' ')
    expect(text.slice(1, -1)).toMatch(/^ +$/);
  });

  it("shares remainder equally between multiple flex slots", () => {
    const out = composeLines(
      [
        [
          cell({ text: "A", merged: "merge-no-padding" }),
          cell({ text: " ", flex: true, merged: "merge-no-padding" }),
          cell({ text: "B", merged: "merge-no-padding" }),
          cell({ text: " ", flex: true, merged: "merge-no-padding" }),
          cell({ text: "C", merged: "merge-no-padding" }),
        ],
      ],
      baseOptions({ width: 13 }),
    );
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text.length).toBe(13);
    expect(text.startsWith("A")).toBe(true);
    expect(text).toContain("B");
    expect(text.endsWith("C")).toBe(true);
  });
});

describe("composeLines (Powerline mode)", () => {
  it("delegates to applyPowerlineLines when enabled", () => {
    const out = composeLines(
      [[cell({ text: "a", bg: "red" }), cell({ text: "b", bg: "blue" })]],
      baseOptions({}, { enabled: true }),
    );
    expect(out).toHaveLength(1);
    // Two cells + chevron between
    expect(out[0]?.length).toBeGreaterThanOrEqual(3);
    // Chevron carries adjoining colours
    const chev = out[0]?.[1];
    expect(chev?.fg).toBe("red");
    expect(chev?.bg).toBe("blue");
  });

  it("uses ASCII glyphs when glyphSupport='ascii'", () => {
    const out = composeLines(
      [[cell({ text: "a", bg: "red" }), cell({ text: "b", bg: "blue" })]],
      baseOptions({ glyphSupport: "ascii" }, { enabled: true }),
    );
    const chev = out[0]?.[1];
    expect(chev?.text).toBe(">");
  });

  it("flex-separator is dropped (no-op in PL mode)", () => {
    const out = composeLines(
      [[cell({ text: "a", bg: "red" }), cell({ flex: true }), cell({ text: "b", bg: "blue" })]],
      baseOptions({}, { enabled: true }),
    );
    const text = out[0]?.map((s) => s.text).join("") ?? "";
    expect(text).toContain("a");
    expect(text).toContain("b");
    // The flex marker must not surface as a visible space-only segment
    expect(out[0]?.some((s) => s.text === " " && s.bg === undefined)).toBe(false);
  });
});
