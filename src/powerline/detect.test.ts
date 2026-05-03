import { describe, expect, it } from "vitest";

import { detectGlyphSupport } from "./detect.js";

describe("detectGlyphSupport", () => {
  it("returns 'nerd' by default", () => {
    expect(detectGlyphSupport({})).toBe("nerd");
  });

  it("honours AGENTLINE_GLYPHS=ascii", () => {
    expect(detectGlyphSupport({ AGENTLINE_GLYPHS: "ascii" })).toBe("ascii");
  });

  it("honours AGENTLINE_GLYPHS=nerd", () => {
    expect(detectGlyphSupport({ AGENTLINE_GLYPHS: "nerd" })).toBe("nerd");
  });

  it("treats unicode as nerd", () => {
    expect(detectGlyphSupport({ AGENTLINE_GLYPHS: "unicode" })).toBe("nerd");
  });

  it("ignores unknown values", () => {
    expect(detectGlyphSupport({ AGENTLINE_GLYPHS: "garbage" })).toBe("nerd");
  });

  it("is case-insensitive", () => {
    expect(detectGlyphSupport({ AGENTLINE_GLYPHS: "ASCII" })).toBe("ascii");
  });
});
