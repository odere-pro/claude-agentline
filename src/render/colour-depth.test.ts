/**
 * Unit tests for colour-depth detection.
 */

import { describe, it, expect } from "vitest";
import { detectColourDepth, type ColourDepthSource } from "./colour-depth.js";

describe("detectColourDepth", () => {
  it("detects truecolor from COLORTERM=truecolor", () => {
    const source: ColourDepthSource = {
      env: { COLORTERM: "truecolor" },
    };
    expect(detectColourDepth(source)).toBe("truecolor");
  });

  it("detects truecolor from COLORTERM=24bit", () => {
    const source: ColourDepthSource = {
      env: { COLORTERM: "24bit" },
    };
    expect(detectColourDepth(source)).toBe("truecolor");
  });

  it("ignores case for COLORTERM", () => {
    const source: ColourDepthSource = {
      env: { COLORTERM: "TRUECOLOR" },
    };
    expect(detectColourDepth(source)).toBe("truecolor");
  });

  it("detects 256-colour from TERM=*-256color", () => {
    const source: ColourDepthSource = {
      env: { TERM: "xterm-256color" },
    };
    expect(detectColourDepth(source)).toBe("256");
  });

  it("detects 256-colour from TERM=xterm-kitty", () => {
    const source: ColourDepthSource = {
      env: { TERM: "xterm-kitty" },
    };
    expect(detectColourDepth(source)).toBe("256");
  });

  it("detects 16-colour from TERM=xterm", () => {
    const source: ColourDepthSource = {
      env: { TERM: "xterm" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=screen", () => {
    const source: ColourDepthSource = {
      env: { TERM: "screen" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=tmux", () => {
    const source: ColourDepthSource = {
      env: { TERM: "tmux" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=rxvt", () => {
    const source: ColourDepthSource = {
      env: { TERM: "rxvt" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=vt100", () => {
    const source: ColourDepthSource = {
      env: { TERM: "vt100" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=vt220", () => {
    const source: ColourDepthSource = {
      env: { TERM: "vt220" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=linux", () => {
    const source: ColourDepthSource = {
      env: { TERM: "linux" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects 16-colour from TERM=ansi", () => {
    const source: ColourDepthSource = {
      env: { TERM: "ansi" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("detects none for TERM=dumb", () => {
    const source: ColourDepthSource = {
      env: { TERM: "dumb" },
    };
    expect(detectColourDepth(source)).toBe("none");
  });

  it("detects none for empty TERM", () => {
    const source: ColourDepthSource = {
      env: { TERM: "" },
    };
    expect(detectColourDepth(source)).toBe("none");
  });

  it("detects none for missing TERM", () => {
    const source: ColourDepthSource = {
      env: {},
    };
    expect(detectColourDepth(source)).toBe("none"); // Missing TERM treated as empty string
  });

  it("prioritizes COLORTERM over TERM", () => {
    const source: ColourDepthSource = {
      env: { COLORTERM: "truecolor", TERM: "vt100" },
    };
    expect(detectColourDepth(source)).toBe("truecolor");
  });

  it("defaults to 16 for unknown TERM", () => {
    const source: ColourDepthSource = {
      env: { TERM: "unknown-terminal" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("ignores case for TERM matching", () => {
    const source: ColourDepthSource = {
      env: { TERM: "XTERM" },
    };
    expect(detectColourDepth(source)).toBe("16");
  });

  it("handles whitespace in COLORTERM", () => {
    const source: ColourDepthSource = {
      env: { COLORTERM: "  truecolor  " },
    };
    expect(detectColourDepth(source)).toBe("truecolor");
  });
});
