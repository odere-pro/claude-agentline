import { describe, expect, it } from "vitest";

import {
  applyAccessibility,
  effectiveDepth,
  honourNoColorEnv,
  parseAccessibilityArgs,
  stripNonAscii,
} from "./accessibility.js";
import type { Segment } from "../segment/segment.js";

describe("parseAccessibilityArgs", () => {
  it("recognises --no-color (US + UK)", () => {
    expect(parseAccessibilityArgs(["--no-color"])).toEqual({ noColor: true, noUnicode: false });
    expect(parseAccessibilityArgs(["--no-colour"])).toEqual({ noColor: true, noUnicode: false });
  });

  it("recognises --no-unicode", () => {
    expect(parseAccessibilityArgs(["--no-unicode"])).toEqual({ noColor: false, noUnicode: true });
  });

  it("--ascii implies both", () => {
    expect(parseAccessibilityArgs(["--ascii"])).toEqual({ noColor: true, noUnicode: true });
  });

  it("ignores unrelated flags", () => {
    expect(parseAccessibilityArgs(["--config", "x.json"])).toEqual({
      noColor: false,
      noUnicode: false,
    });
  });
});

describe("honourNoColorEnv", () => {
  it("forces noColor when NO_COLOR is non-empty", () => {
    expect(honourNoColorEnv({ noColor: false, noUnicode: false }, { NO_COLOR: "1" })).toEqual({
      noColor: true,
      noUnicode: false,
    });
  });

  it("ignores empty NO_COLOR per the spec at no-color.org", () => {
    expect(honourNoColorEnv({ noColor: false, noUnicode: false }, { NO_COLOR: "" })).toEqual({
      noColor: false,
      noUnicode: false,
    });
  });

  it("preserves existing flags when env is unset", () => {
    expect(honourNoColorEnv({ noColor: false, noUnicode: true }, {})).toEqual({
      noColor: false,
      noUnicode: true,
    });
  });
});

describe("effectiveDepth", () => {
  it("forces 'none' when noColor is true", () => {
    expect(effectiveDepth("truecolor", { noColor: true, noUnicode: false })).toBe("none");
  });

  it("returns the detected depth otherwise", () => {
    expect(effectiveDepth("256", { noColor: false, noUnicode: false })).toBe("256");
  });
});

describe("stripNonAscii", () => {
  it("preserves ASCII text", () => {
    expect(stripNonAscii("hello world 123 !?")).toBe("hello world 123 !?");
  });

  it("substitutes mapped glyphs", () => {
    expect(stripNonAscii("a · b ✓ c ✗ d")).toBe("a . b v c x d");
  });

  it("falls back to ? for unknown codepoints", () => {
    expect(stripNonAscii("hello 你好")).toBe("hello ??");
  });
});

describe("applyAccessibility", () => {
  it("returns the same segments when noUnicode is false", () => {
    const segs: Segment[] = [{ text: "a · b" }];
    expect(applyAccessibility(segs, { noColor: false, noUnicode: false })).toBe(segs);
  });

  it("rewrites segment text when noUnicode is true", () => {
    const segs: Segment[] = [
      { text: "a · b", fg: "red" },
      { text: "✓", bg: "blue" },
    ];
    const result = applyAccessibility(segs, { noColor: false, noUnicode: true });
    expect(result.map((s) => s.text)).toEqual(["a . b", "v"]);
    expect(result[0]?.fg).toBe("red");
    expect(result[1]?.bg).toBe("blue");
  });
});
