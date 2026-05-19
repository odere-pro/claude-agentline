import { describe, expect, it } from "vitest";

import { createTranslator, identityTranslator } from "./loader.js";

describe("identityTranslator", () => {
  it("returns the English text verbatim", () => {
    expect(identityTranslator("any.id", "Hello")).toBe("Hello");
  });

  it("interpolates {name} placeholders", () => {
    expect(identityTranslator("x", "saved → {path}", { path: "/c.json" })).toBe("saved → /c.json");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(identityTranslator("x", "a {missing} b", { other: 1 })).toBe("a {missing} b");
  });
});

describe("createTranslator", () => {
  it("is the identity translator when language is en", () => {
    const t = createTranslator({ language: "en", translations: {} });
    expect(t("widget.model.name", "Model")).toBe("Model");
  });

  it("is the identity translator when the locale has no table", () => {
    const t = createTranslator({ language: "fr", translations: {} });
    expect(t("widget.model.name", "Model")).toBe("Model");
  });

  it("uses the locale table when present", () => {
    const t = createTranslator({
      language: "fr",
      translations: { fr: { "widget.model.name": "Modèle" } },
    });
    expect(t("widget.model.name", "Model")).toBe("Modèle");
  });

  it("falls back to English for ids the locale omits", () => {
    const t = createTranslator({
      language: "fr",
      translations: { fr: { "widget.model.name": "Modèle" } },
    });
    expect(t("widget.model.desc", "Active model id")).toBe("Active model id");
  });

  it("interpolates against the translated string", () => {
    const t = createTranslator({
      language: "fr",
      translations: { fr: { "app.saved": "enregistré → {path}" } },
    });
    expect(t("app.saved", "saved → {path}", { path: "/c" })).toBe("enregistré → /c");
  });
});
