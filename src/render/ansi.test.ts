import { describe, expect, it } from "vitest";

import { encodeSegments, SGR_RESET } from "./ansi.js";
import type { Segment } from "./segment.js";

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

  it("wraps plain text in OSC 8 when href is set", () => {
    const segs: Segment[] = [{ text: "docs", href: "https://example.com" }];
    expect(encodeSegments(segs, "truecolor")).toBe(
      `${OSC_OPEN}https://example.com${OSC_ST}docs${OSC_CLOSE}`,
    );
  });

  it("wraps styled text inside the SGR run", () => {
    const segs: Segment[] = [{ text: "docs", fg: "red", href: "https://example.com" }];
    expect(encodeSegments(segs, "16")).toBe(
      `${ESC}31m${OSC_OPEN}https://example.com${OSC_ST}docs${OSC_CLOSE}${SGR_RESET}`,
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
      `${OSC_OPEN}https://example.com${OSC_ST}docs${OSC_CLOSE}`,
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
    expect(out).toContain(`${OSC_OPEN}https://a.example${OSC_ST}a${OSC_CLOSE}`);
    expect(out).toContain(`${OSC_OPEN}https://b.example${OSC_ST}b${OSC_CLOSE}`);
  });
});
