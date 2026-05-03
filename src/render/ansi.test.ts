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
