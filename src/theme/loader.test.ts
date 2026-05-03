import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PALETTE,
  THEME_ROLES,
  ThemeLoadError,
  listThemesIn,
  loadTheme,
  loadThemeFromString,
  resolveRole,
} from "./index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const themesDir = path.resolve(here, "..", "..", "themes");

const SHIPPED_THEMES = [
  "vscode-dark",
  "vscode-light",
  "claude-code-dark",
  "claude-code-light",
] as const;

describe("loadThemeFromString", () => {
  it("parses a minimal valid theme", () => {
    const json = {
      name: "demo",
      palette: Object.fromEntries(THEME_ROLES.map((r) => [r, "#000000"])),
    };
    const theme = loadThemeFromString(JSON.stringify(json));
    expect(theme.name).toBe("demo");
    for (const role of THEME_ROLES) {
      expect(theme.palette[role]).toBe("#000000");
    }
    expect(theme.powerline.capsStart).toBe("");
    expect(theme.powerline.capsEnd).toBe("");
  });

  it("rejects malformed JSON", () => {
    expect(() => loadThemeFromString("{not valid")).toThrow(ThemeLoadError);
  });

  it("rejects missing palette role", () => {
    const json = {
      name: "broken",
      palette: { accent: "#ffffff" },
    };
    expect(() => loadThemeFromString(JSON.stringify(json))).toThrow(/schema validation/);
  });

  it("rejects invalid colour value", () => {
    const palette = Object.fromEntries(THEME_ROLES.map((r) => [r, "#000000"]));
    palette.accent = "not-a-colour";
    const json = { name: "broken", palette };
    expect(() => loadThemeFromString(JSON.stringify(json))).toThrow(ThemeLoadError);
  });

  it("rejects extra properties", () => {
    const palette = Object.fromEntries(THEME_ROLES.map((r) => [r, "#000000"]));
    const json = { name: "broken", palette, extra: true };
    expect(() => loadThemeFromString(JSON.stringify(json))).toThrow(/schema validation/);
  });

  it("respects powerline caps", () => {
    const json = {
      name: "demo",
      palette: Object.fromEntries(THEME_ROLES.map((r) => [r, "#000000"])),
      powerline: { "caps.start": "", "caps.end": "" },
    };
    const theme = loadThemeFromString(JSON.stringify(json));
    expect(theme.powerline.capsStart).toBe("");
    expect(theme.powerline.capsEnd).toBe("");
  });
});

describe("resolveRole", () => {
  it("returns the theme palette colour", () => {
    const palette = Object.fromEntries(THEME_ROLES.map((r) => [r, "#abcdef"]));
    const theme = loadThemeFromString(JSON.stringify({ name: "x", palette }));
    expect(resolveRole(theme, "accent")).toBe("#abcdef");
  });

  it("falls back to compiled defaults when theme is null", () => {
    expect(resolveRole(null, "accent")).toBe(DEFAULT_PALETTE.accent);
    expect(resolveRole(null, "danger")).toBe(DEFAULT_PALETTE.danger);
  });
});

describe("shipped themes", () => {
  it.each(SHIPPED_THEMES)("loads %s", async (name) => {
    const theme = await loadTheme(path.join(themesDir, `${name}.json`));
    expect(theme.name).toBe(name);
    for (const role of THEME_ROLES) {
      expect(theme.palette[role]).toMatch(/^(#[0-9a-fA-F]{6}|colour:\d+|[a-z-]+)$/);
    }
  });

  it("listThemesIn returns all 10 sorted", async () => {
    const listing = await listThemesIn(themesDir);
    expect(listing.errors).toEqual([]);
    expect(listing.themes.map((t) => t.name).sort()).toEqual([...SHIPPED_THEMES].sort());
  });

  it("schema file matches the embedded schema id", async () => {
    const raw = await fs.readFile(path.resolve(here, "..", "..", "schemas", "theme.schema.json"), "utf8");
    const json = JSON.parse(raw) as { $id: string };
    expect(json.$id).toBe("https://agentline.dev/schemas/theme.schema.json");
  });
});
