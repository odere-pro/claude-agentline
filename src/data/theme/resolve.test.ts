import { promises as fs } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { THEME_ROLES } from "./roles.js";
import { defaultBuiltinThemesDir, resolveConfiguredTheme, themeDirectories } from "./resolve.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_THEMES_DIR = path.resolve(here, "..", "..", "..", "themes");

/** Build a schema-valid palette where every role is `colour`. */
function paletteOf(colour: string): Record<string, string> {
  return Object.fromEntries(THEME_ROLES.map((r) => [r, colour]));
}

describe("themeDirectories", () => {
  it("puts the user themes/ dir first, then the bundled one", () => {
    const dirs = themeDirectories({
      env: { CLAUDE_CONFIG_DIR: "/tmp/cfg" },
      builtinDir: "/pkg/themes",
    });
    expect(dirs).toEqual(["/tmp/cfg/agentline/themes", "/pkg/themes"]);
  });

  it("honours CLAUDE_CONFIG_DIR for the user themes path", () => {
    const dirs = themeDirectories({
      env: { CLAUDE_CONFIG_DIR: "/var/conf" },
      builtinDir: "/x",
    });
    expect(dirs[0]).toBe("/var/conf/agentline/themes");
  });

  it("falls back to the bundled default when no override is provided", () => {
    const dirs = themeDirectories({ env: { CLAUDE_CONFIG_DIR: "/x" } });
    expect(dirs[1]).toBe(defaultBuiltinThemesDir());
  });
});

describe("resolveConfiguredTheme", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "agentline-theme-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null for empty / undefined names", async () => {
    expect(await resolveConfiguredTheme(null, { builtinDir: tmp })).toBeNull();
    expect(await resolveConfiguredTheme(undefined, { builtinDir: tmp })).toBeNull();
    expect(await resolveConfiguredTheme("", { builtinDir: tmp })).toBeNull();
  });

  it("rejects path-shaped names (no traversal escape)", async () => {
    expect(await resolveConfiguredTheme("../../etc/passwd", { builtinDir: tmp })).toBeNull();
    expect(await resolveConfiguredTheme(".hidden", { builtinDir: tmp })).toBeNull();
    expect(await resolveConfiguredTheme("a/b", { builtinDir: tmp })).toBeNull();
  });

  it("loads a bundled theme from the shipped themes/ directory", async () => {
    const theme = await resolveConfiguredTheme("claude-code-dark", {
      env: { CLAUDE_CONFIG_DIR: tmp },
      builtinDir: SHIPPED_THEMES_DIR,
    });
    expect(theme).not.toBeNull();
    expect(theme?.name).toBe("claude-code-dark");
    // The shipped dark palette has a real accent — not the default fallback.
    expect(theme?.palette.accent).toBe("#cc785c");
  });

  it("prefers the user themes/ dir over the bundled one when both define the name", async () => {
    const userDir = path.join(tmp, "agentline", "themes");
    await fs.mkdir(userDir, { recursive: true });
    const userTheme = {
      name: "claude-code-dark",
      palette: { ...paletteOf("#000000"), accent: "#ff00ff" },
    };
    await fs.writeFile(
      path.join(userDir, "claude-code-dark.json"),
      JSON.stringify(userTheme),
      "utf8",
    );
    const theme = await resolveConfiguredTheme("claude-code-dark", {
      env: { CLAUDE_CONFIG_DIR: tmp },
      builtinDir: SHIPPED_THEMES_DIR,
    });
    expect(theme?.palette.accent).toBe("#ff00ff");
  });

  it("returns null when the named theme is not on the search path", async () => {
    expect(
      await resolveConfiguredTheme("does-not-exist", {
        env: { CLAUDE_CONFIG_DIR: tmp },
        builtinDir: SHIPPED_THEMES_DIR,
      }),
    ).toBeNull();
  });

  it("returns null (does not throw) when the theme file is malformed", async () => {
    await fs.writeFile(path.join(tmp, "broken.json"), "{ not valid json", "utf8");
    const theme = await resolveConfiguredTheme("broken", {
      env: { CLAUDE_CONFIG_DIR: "/nonexistent" },
      builtinDir: tmp,
    });
    expect(theme).toBeNull();
  });
});
