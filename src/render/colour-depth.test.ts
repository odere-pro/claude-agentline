import { describe, expect, it } from "vitest";

import { detectColourDepth } from "./colour-depth.js";

describe("detectColourDepth", () => {
  it("recognises COLORTERM=truecolor", () => {
    expect(detectColourDepth({ env: { COLORTERM: "truecolor", TERM: "xterm-256color" } })).toBe(
      "truecolor",
    );
  });

  it("recognises COLORTERM=24bit (case-insensitive)", () => {
    expect(detectColourDepth({ env: { COLORTERM: "24BIT", TERM: "xterm" } })).toBe("truecolor");
  });

  it("recognises *-256color TERM as 256", () => {
    expect(detectColourDepth({ env: { TERM: "screen-256color" } })).toBe("256");
    expect(detectColourDepth({ env: { TERM: "tmux-256color" } })).toBe("256");
  });

  it("recognises xterm-kitty as 256", () => {
    expect(detectColourDepth({ env: { TERM: "xterm-kitty" } })).toBe("256");
  });

  it("recognises common 16-colour TERMs", () => {
    expect(detectColourDepth({ env: { TERM: "xterm" } })).toBe("16");
    expect(detectColourDepth({ env: { TERM: "screen" } })).toBe("16");
    expect(detectColourDepth({ env: { TERM: "vt100" } })).toBe("16");
  });

  it("treats dumb terminal as none", () => {
    expect(detectColourDepth({ env: { TERM: "dumb" } })).toBe("none");
  });

  it("treats missing TERM as none", () => {
    expect(detectColourDepth({ env: {} })).toBe("none");
  });

  it("falls back to 16 for unknown TERMs", () => {
    expect(detectColourDepth({ env: { TERM: "weirdterm-x" } })).toBe("16");
  });
});
