import { describe, expect, it } from "vitest";

import { unicodeCapable } from "./unicode-env.js";

describe("unicodeCapable", () => {
  it("is true by default on a UTF-8 locale", () => {
    expect(unicodeCapable({ env: { LANG: "en_US.UTF-8" } })).toBe(true);
  });

  it("is false when NO_UNICODE=1", () => {
    expect(unicodeCapable({ env: { NO_UNICODE: "1" } })).toBe(false);
  });

  it("is false when AGENTLINE_GLYPHS=ascii (matches the render-path env var)", () => {
    expect(unicodeCapable({ env: { AGENTLINE_GLYPHS: "ascii", LANG: "en_US.UTF-8" } })).toBe(false);
  });

  it("is false on a non-UTF locale", () => {
    expect(unicodeCapable({ env: { LANG: "POSIX" } })).toBe(false);
  });

  it("treats an empty locale as capable (no negative signal)", () => {
    expect(unicodeCapable({ env: {} })).toBe(true);
  });

  it("explicit override wins over env hints", () => {
    expect(unicodeCapable({ unicode: true, env: { NO_UNICODE: "1" } })).toBe(true);
    expect(unicodeCapable({ unicode: false, env: { LANG: "en_US.UTF-8" } })).toBe(false);
  });

  it("prefers LC_ALL over LC_CTYPE over LANG", () => {
    expect(unicodeCapable({ env: { LC_ALL: "C", LANG: "en_US.UTF-8" } })).toBe(false);
    expect(unicodeCapable({ env: { LC_CTYPE: "en_US.UTF-8", LANG: "C" } })).toBe(true);
  });
});
