import { describe, expect, it } from "vitest";

import { pickGlyphs } from "./glyphs.js";

describe("pickGlyphs", () => {
  it("returns Unicode glyphs by default on a UTF-8 locale", () => {
    const g = pickGlyphs({ env: { LANG: "en_US.UTF-8" } });
    expect(g.activeRow).toBe("▸");
    expect(g.selectionOpen).toBe("‹");
    expect(g.addCell).toBe("＋ add widget");
  });

  it("degrades to ASCII when NO_UNICODE=1", () => {
    const g = pickGlyphs({ env: { NO_UNICODE: "1" } });
    expect(g.activeRow).toBe(">");
    expect(g.selectionOpen).toBe("[");
    expect(g.addCell).toBe("+ add widget");
  });

  it("degrades to ASCII when AGENTLINE_GLYPHS=ascii (matches the render-path env var)", () => {
    const g = pickGlyphs({ env: { AGENTLINE_GLYPHS: "ascii", LANG: "en_US.UTF-8" } });
    expect(g.activeRow).toBe(">");
  });

  it("degrades to ASCII on a non-UTF locale", () => {
    const g = pickGlyphs({ env: { LANG: "POSIX" } });
    expect(g.activeRow).toBe(">");
  });

  it("explicit unicode override wins over env hints", () => {
    expect(pickGlyphs({ unicode: true, env: { NO_UNICODE: "1" } }).activeRow).toBe("▸");
    expect(pickGlyphs({ unicode: false, env: { LANG: "en_US.UTF-8" } }).activeRow).toBe(">");
  });

  it("ships an icon for every widget family", () => {
    const g = pickGlyphs({ unicode: true });
    for (const cat of ["session", "tokens", "context", "rate-limits", "git", "time", "custom"] as const) {
      expect(g.family[cat]).toBeTruthy();
    }
  });
});
