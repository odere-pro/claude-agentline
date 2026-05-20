import { describe, expect, it } from "vitest";

import { encodeSegments, resolveColourRgb, SGR_RESET } from "./ansi.js";
import type { Segment } from "../segment/segment.js";

const ESC = "\x1b[";

describe("encodeSegments depth=none", () => {
  it("emits plain text without escapes", () => {
    const segs: Segment[] = [
      { text: "alpha", fg: "red" },
      { text: "beta", bg: "#112233" },
    ];
    expect(encodeSegments(segs, "none")).toBe("alphabeta");
  });
});

describe("encodeSegments depth=truecolor", () => {
  it("emits 24-bit fg + reset for hex colour", () => {
    const segs: Segment[] = [{ text: "hello", fg: "#102030" }];
    expect(encodeSegments(segs, "truecolor")).toBe(`${ESC}38;2;16;32;48mhello${SGR_RESET}`);
  });

  it("merges identically-styled adjacent segments without re-emitting SGR", () => {
    const segs: Segment[] = [
      { text: "a", fg: "#102030" },
      { text: "b", fg: "#102030" },
    ];
    expect(encodeSegments(segs, "truecolor")).toBe(`${ESC}38;2;16;32;48mab${SGR_RESET}`);
  });

  it("resets between style changes", () => {
    const segs: Segment[] = [
      { text: "a", fg: "#102030" },
      { text: "b", fg: "#a0b0c0" },
    ];
    const out = encodeSegments(segs, "truecolor");
    expect(out).toContain(SGR_RESET);
    expect(out).toContain(`${ESC}38;2;160;176;192m`);
  });

  it("plain segments do not introduce stray SGR", () => {
    const segs: Segment[] = [{ text: "plain" }];
    expect(encodeSegments(segs, "truecolor")).toBe("plain");
  });
});

describe("encodeSegments depth=256", () => {
  it("emits indexed escape for colour:NNN", () => {
    const segs: Segment[] = [{ text: "x", fg: "colour:42" }];
    expect(encodeSegments(segs, "256")).toBe(`${ESC}38;5;42mx${SGR_RESET}`);
  });

  it("downgrades hex via cube quantisation", () => {
    const segs: Segment[] = [{ text: "x", fg: "#ffffff" }];
    const out = encodeSegments(segs, "256");
    expect(out.startsWith(`${ESC}38;5;`)).toBe(true);
  });
});

describe("encodeSegments depth=16", () => {
  it("emits 30..37 for basic named fg", () => {
    const segs: Segment[] = [{ text: "r", fg: "red" }];
    expect(encodeSegments(segs, "16")).toBe(`${ESC}31mr${SGR_RESET}`);
  });

  it("emits 90..97 for bright named fg", () => {
    const segs: Segment[] = [{ text: "r", fg: "bright-cyan" }];
    expect(encodeSegments(segs, "16")).toBe(`${ESC}96mr${SGR_RESET}`);
  });

  it("emits 40..47 for basic named bg", () => {
    const segs: Segment[] = [{ text: "g", bg: "green" }];
    expect(encodeSegments(segs, "16")).toBe(`${ESC}42mg${SGR_RESET}`);
  });
});

describe("encodeSegments style flags", () => {
  it("emits bold and italic before colour", () => {
    const segs: Segment[] = [{ text: "x", fg: "red", bold: true, italic: true }];
    const out = encodeSegments(segs, "16");
    expect(out).toBe(`${ESC}1m${ESC}3m${ESC}31mx${SGR_RESET}`);
  });
});

describe("encodeSegments OSC 8 hyperlink", () => {
  // OSC 8 opens with `ESC]8;;URL\\ESC\\` and closes with `ESC]8;;\\ESC\\`.
  const OSC_OPEN = "\x1b]8;;";
  const OSC_ST = "\x1b\\";
  const OSC_CLOSE = `${OSC_OPEN}${OSC_ST}`;
  // Links are underlined: label is bracketed by underline-on / -off.
  const U_ON = `${ESC}4m`;
  const U_OFF = `${ESC}24m`;

  it("wraps plain text in OSC 8 (underlined) when href is set", () => {
    const segs: Segment[] = [{ text: "docs", href: "https://example.com" }];
    expect(encodeSegments(segs, "truecolor")).toBe(
      `${OSC_OPEN}https://example.com${OSC_ST}${U_ON}docs${U_OFF}${OSC_CLOSE}`,
    );
  });

  it("wraps styled text inside the SGR run and underlines the link", () => {
    const segs: Segment[] = [{ text: "docs", fg: "red", href: "https://example.com" }];
    expect(encodeSegments(segs, "16")).toBe(
      `${ESC}31m${OSC_OPEN}https://example.com${OSC_ST}${U_ON}docs${U_OFF}${OSC_CLOSE}${SGR_RESET}`,
    );
  });

  it("drops OSC 8 entirely at depth=none", () => {
    const segs: Segment[] = [{ text: "docs", href: "https://example.com" }];
    expect(encodeSegments(segs, "none")).toBe("docs");
  });

  it("strips control characters from the URL before emitting", () => {
    /*
     * The terminator is `ESC\\`; an unsanitised `ESC` inside the URL
     * would close the sequence early and dump the rest as literal text.
     */
    const segs: Segment[] = [{ text: "docs", href: "https://example.com\x1b\x07" }];
    expect(encodeSegments(segs, "truecolor")).toBe(
      `${OSC_OPEN}https://example.com${OSC_ST}${U_ON}docs${U_OFF}${OSC_CLOSE}`,
    );
  });

  it("emits no OSC 8 wrap when sanitisation reduces the URL to empty", () => {
    const segs: Segment[] = [{ text: "docs", href: "\x1b\x00\x07" }];
    expect(encodeSegments(segs, "truecolor")).toBe("docs");
  });

  it("wraps each segment independently so different hrefs do not bleed", () => {
    const segs: Segment[] = [
      { text: "a", fg: "red", href: "https://a.example" },
      { text: "b", fg: "red", href: "https://b.example" },
    ];
    const out = encodeSegments(segs, "16");
    expect(out).toContain(`${OSC_OPEN}https://a.example${OSC_ST}${U_ON}a${U_OFF}${OSC_CLOSE}`);
    expect(out).toContain(`${OSC_OPEN}https://b.example${OSC_ST}${U_ON}b${U_OFF}${OSC_CLOSE}`);
  });
});

describe("resolveColourRgb", () => {
  it("returns null at depth=none so the caller omits the colour", () => {
    expect(resolveColourRgb("magenta", "none")).toBeNull();
    expect(resolveColourRgb("#102030", "none")).toBeNull();
    expect(resolveColourRgb("colour:208", "none")).toBeNull();
  });

  it("resolves a named colour to the bin's fixed palette RGB at every depth", () => {
    // magenta is index 5 in the basic palette, so it round-trips exactly
    // through the 256/16 mappings — the bin's own NAMED_RGB value.
    const magenta = { r: 188, g: 63, b: 188 };
    expect(resolveColourRgb("magenta", "truecolor")).toEqual(magenta);
    expect(resolveColourRgb("magenta", "256")).toEqual(magenta);
    expect(resolveColourRgb("magenta", "16")).toEqual(magenta);
  });

  it("resolves a bright named colour to its bright palette RGB", () => {
    const brightBlue = { r: 59, g: 142, b: 234 };
    expect(resolveColourRgb("bright-blue", "truecolor")).toEqual(brightBlue);
    expect(resolveColourRgb("bright-blue", "256")).toEqual(brightBlue);
    expect(resolveColourRgb("bright-blue", "16")).toEqual(brightBlue);
  });

  it("resolves an indexed colour the editor preview previously dropped", () => {
    // `colour:208` is the regression case: Ink could not render the
    // `colour:NNN` form at all, so the chip lost its colour. The bin maps
    // 208 through the 6×6×6 cube to orange.
    expect(resolveColourRgb("colour:208", "truecolor")).toEqual({ r: 255, g: 102, b: 0 });
    expect(resolveColourRgb("colour:208", "256")).toEqual({ r: 255, g: 102, b: 0 });
  });

  it("passes a truecolor hex through unchanged", () => {
    expect(resolveColourRgb("#102030", "truecolor")).toEqual({ r: 16, g: 32, b: 48 });
  });
});
