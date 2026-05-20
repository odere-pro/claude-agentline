import { describe, expect, it } from "vitest";

import type { FamiliesConfig } from "../../data/config/types.js";
import type { WidgetFamily } from "./catalog-types.js";
import { createThemeFactory } from "./family-factory.js";
import { resolveFamilyIdentity } from "./family-identity.js";

const FAMILIES: readonly WidgetFamily[] = ["session", "tokens", "context", "rate-limits", "git"];

describe("ThemeFactory.forFamily", () => {
  it("matches resolveFamilyIdentity for every catalogued family (default env, no overrides)", () => {
    const factory = createThemeFactory();
    for (const family of FAMILIES) {
      expect(factory.forFamily(family)).toEqual(resolveFamilyIdentity(family));
    }
  });

  it("layers config.families overrides per family", () => {
    const overrides: FamiliesConfig = {
      git: { colour: "magenta", glyph: "G" },
      tokens: { colour: "cyan" },
    };
    const factory = createThemeFactory({}, overrides);
    expect(factory.forFamily("git").colour).toBe("magenta");
    expect(factory.forFamily("tokens").colour).toBe("cyan");
    // Unspecified families fall through to the built-in floor.
    expect(factory.forFamily("session")).toEqual(resolveFamilyIdentity("session"));
  });

  it("forces ASCII glyph degradation when env signals non-Unicode", () => {
    const factory = createThemeFactory({ env: { LANG: "C" } });
    const id = factory.forFamily("git");
    // The git family's ASCII stand-in is `[g]`.
    expect(id.glyph).toBe("[g]");
  });

  it("is referentially equivalent to calling resolveFamilyIdentity with the same args", () => {
    const env = { env: { LANG: "en_US.UTF-8" } };
    const overrides: FamiliesConfig = { context: { colour: "yellow" } };
    const factory = createThemeFactory(env, overrides);
    for (const family of FAMILIES) {
      expect(factory.forFamily(family)).toEqual(
        resolveFamilyIdentity(family, env, overrides[family]),
      );
    }
  });
});
