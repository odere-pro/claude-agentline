import { describe, expect, it } from "vitest";

import { renderLine } from "./index.js";

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

describe("renderLine", () => {
  it("encodes coloured segments at the requested depth", () => {
    const out = renderLine([{ text: "x", fg: "red" }], {
      depth: "16",
      flags: { noColor: false, noUnicode: false },
    });
    expect(out).toBe(`${ESC}31mx${RESET}`);
  });

  it("strips ANSI escapes when noColor is true", () => {
    const out = renderLine([{ text: "x", fg: "red" }], {
      depth: "truecolor",
      flags: { noColor: true, noUnicode: false },
    });
    expect(out).toBe("x");
  });

  it("rewrites unicode glyphs when noUnicode is true", () => {
    const out = renderLine([{ text: "a · b" }], {
      depth: "none",
      flags: { noColor: false, noUnicode: true },
    });
    expect(out).toBe("a . b");
  });

  it("ascii-equivalent output is byte-identical regardless of depth", () => {
    const segs = [{ text: "x · y" }];
    const flags = { noColor: true, noUnicode: true };
    expect(renderLine(segs, { depth: "truecolor", flags })).toBe(
      renderLine(segs, { depth: "256", flags }),
    );
    expect(renderLine(segs, { depth: "truecolor", flags })).toBe(
      renderLine(segs, { depth: "16", flags }),
    );
  });
});
