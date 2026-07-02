import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PALETTE,
  THEME_ROLES,
  ThemeLoadError,
  loadTheme,
  loadThemeFromString,
  resolveRole,
} from "./index.js";
import { parseColour } from "./colours/colours.js";
import { REQUIRED_THEME_ROLES } from "./roles.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const themesDir = path.resolve(here, "..", "..", "..", "themes");

const SHIPPED_THEME = "claude-code-dark";

/** The curated built-in theme gallery (issue #261). */
const SHIPPED_GALLERY = [
  "claude-code-dark",
  "claude-code-light",
  "high-contrast",
  "ansi-minimal",
  "midnight",
] as const;

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

  it("accepts a theme omitting the optional effort-ultracode role", () => {
    // Only the required tier is supplied — no effort-ultracode key.
    const palette = Object.fromEntries(REQUIRED_THEME_ROLES.map((r) => [r, "#000000"]));
    const theme = loadThemeFromString(JSON.stringify({ name: "no-optional", palette }));
    // The omitted optional role falls back to the compiled default, so it is
    // non-breaking: an older/user theme that never set it still resolves.
    expect(theme.palette["effort-ultracode"]).toBe(DEFAULT_PALETTE["effort-ultracode"]);
  });

  it("honours an explicit effort-ultracode value when supplied", () => {
    const palette = Object.fromEntries(THEME_ROLES.map((r) => [r, "#000000"]));
    palette["effort-ultracode"] = "#6d28d9";
    const theme = loadThemeFromString(JSON.stringify({ name: "with-optional", palette }));
    expect(theme.palette["effort-ultracode"]).toBe("#6d28d9");
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
    expect(resolveRole(null, "effort-ultracode")).toBe(DEFAULT_PALETTE["effort-ultracode"]);
  });
});

describe("shipped theme", () => {
  it("loads claude-code-dark", async () => {
    const theme = await loadTheme(path.join(themesDir, `${SHIPPED_THEME}.json`));
    expect(theme.name).toBe(SHIPPED_THEME);
    for (const role of THEME_ROLES) {
      expect(theme.palette[role]).toMatch(/^(#[0-9a-fA-F]{6}|colour:\d+|[a-z-]+)$/);
    }
  });

  it("schema file matches the embedded schema id", async () => {
    const raw = await fs.readFile(
      path.resolve(here, "..", "..", "..", "schemas", "theme.schema.json"),
      "utf8",
    );
    const json = JSON.parse(raw) as { $id: string };
    expect(json.$id).toBe(
      "https://raw.githubusercontent.com/odere-pro/claude-agentline/main/schemas/theme.schema.json",
    );
  });
});

describe("shipped theme gallery", () => {
  it("ships exactly the curated gallery", async () => {
    const files = (await fs.readdir(themesDir)).filter((f) => f.endsWith(".json")).sort();
    const expected = [...SHIPPED_GALLERY].map((n) => `${n}.json`).sort();
    expect(files).toEqual(expected);
  });

  for (const name of SHIPPED_GALLERY) {
    it(`${name} loads, names itself after its file, and every role is a valid colour`, async () => {
      const theme = await loadTheme(path.join(themesDir, `${name}.json`));
      expect(theme.name).toBe(name);
      expect(theme.name).toMatch(KEBAB_CASE);
      for (const role of THEME_ROLES) {
        // parseColour is the colour-depth degradation precondition (gate-16);
        // loadTheme already enforces isColour, so this is the check worth keeping.
        expect(() => parseColour(theme.palette[role])).not.toThrow();
      }
    });
  }

  it("ansi-minimal uses only named ANSI colours so it degrades to a 16-colour terminal unchanged", async () => {
    const theme = await loadTheme(path.join(themesDir, "ansi-minimal.json"));
    for (const role of THEME_ROLES) {
      // `effort-ultracode` is the one exception: ultracode's signature violet is
      // a single fixed value kept identical across every theme (matching the
      // Claude Code CLI), so it is carried as truecolor even here. It degrades
      // to the nearest named colour at render time on a 16-colour terminal.
      if (role === "effort-ultracode") continue;
      expect(parseColour(theme.palette[role]).kind).toBe("named");
    }
    // No Nerd-font powerline caps — the minimal theme stays glyph-free.
    expect(theme.powerline.capsStart).toBe("");
    expect(theme.powerline.capsEnd).toBe("");
  });
});
