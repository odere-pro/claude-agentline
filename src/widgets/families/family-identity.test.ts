import { describe, expect, it } from "vitest";

import { FAMILY_COLOR, WIDGET_FAMILIES } from "./catalog.js";
import { DEFAULT_FAMILY_IDENTITY, resolveFamilyIdentity } from "./family-identity.js";

describe("DEFAULT_FAMILY_IDENTITY", () => {
  it("has an entry for every widget family", () => {
    for (const family of WIDGET_FAMILIES) {
      const id = DEFAULT_FAMILY_IDENTITY[family];
      expect(id.glyph).toBeTruthy();
      expect(id.glyphAscii).toBeTruthy();
      expect(id.colour).toBeTruthy();
    }
  });

  it("uses ◰ for context, not the old tofu ▤", () => {
    expect(DEFAULT_FAMILY_IDENTITY.context.glyph).toBe("◰");
    expect(DEFAULT_FAMILY_IDENTITY.context.glyph).not.toBe("▤");
  });

  it("is the source FAMILY_COLOR projects from", () => {
    for (const family of WIDGET_FAMILIES) {
      expect(FAMILY_COLOR[family]).toBe(DEFAULT_FAMILY_IDENTITY[family].colour);
    }
  });
});

describe("resolveFamilyIdentity", () => {
  it("returns the Unicode glyph on a UTF-8 host", () => {
    const id = resolveFamilyIdentity("session", { env: { LANG: "en_US.UTF-8" } });
    expect(id.glyph).toBe("⌂");
    expect(id.colour).toBe("blue");
  });

  it("degrades the glyph to ASCII when the host can't do Unicode", () => {
    const id = resolveFamilyIdentity("context", { env: { NO_UNICODE: "1" } });
    expect(id.glyph).toBe("[c]");
    expect(id.colour).toBe("magenta");
  });
});
