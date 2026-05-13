/**
 * Tests for `renderForFixture` — specifically that `config.theme` is loaded
 * from the search path and applied to the render, so a user-selected theme
 * actually colours the statusline.
 *
 * The golden harness already covers byte-stability of the no-theme path
 * (every recorded fixture has `theme: null`); these tests target the
 * theme-applied case.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { AgentlineConfig } from "../config/types.js";

import { renderForFixture } from "./fixture-runner.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_THEMES_DIR = path.resolve(here, "..", "..", "themes");

// Minimal stdin payload that drives the `model` widget — its Cell carries
// `fg = resolveRole(ctx.theme, "accent")`, which is the easiest signal to
// detect a theme actually flowing through the pipeline.
const STDIN = JSON.stringify({ model: "claude-opus-4-7" });

// Lock the env so colour-depth detection is deterministic across hosts —
// truecolor lets us assert the exact `38;2;R;G;B` sequence per palette.
const TRUECOLOR_ENV = { COLORTERM: "truecolor", TERM: "xterm-256color" };

function configWithTheme(name: string | null): AgentlineConfig {
  return { ...DEFAULT_CONFIG, theme: name };
}

describe("renderForFixture — theming", () => {
  it("applies a named theme loaded from the bundled themes/ dir", async () => {
    const out = await renderForFixture(STDIN, {
      config: configWithTheme("claude-code-dark"),
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // claude-code-dark `accent` is #cc785c → rgb(204, 120, 92).
    expect(out).toContain("\x1b[38;2;204;120;92m");
    // The widget value itself is preserved.
    expect(out).toContain("Opus 4.7");
  });

  it("falls back to the default palette when config.theme is null", async () => {
    const out = await renderForFixture(STDIN, {
      config: configWithTheme(null),
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // DEFAULT_PALETTE.accent is #7aa2f7 → rgb(122, 162, 247).
    expect(out).toContain("\x1b[38;2;122;162;247m");
  });

  it("falls back silently when config.theme names an unknown theme (never throws)", async () => {
    const out = await renderForFixture(STDIN, {
      config: configWithTheme("does-not-exist"),
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // Default palette stays in effect; never throws.
    expect(out).toContain("\x1b[38;2;122;162;247m");
  });

  it("honours an explicit options.theme = null (e.g. golden fixtures)", async () => {
    // Even though config.theme names a real theme, an explicit `null` opts
    // out of resolution — the path goldens use to keep their fixtures
    // byte-stable regardless of what's on the search path.
    const out = await renderForFixture(STDIN, {
      config: configWithTheme("claude-code-dark"),
      theme: null,
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // Default palette, not claude-code-dark.
    expect(out).toContain("\x1b[38;2;122;162;247m");
    expect(out).not.toContain("\x1b[38;2;204;120;92m");
  });
});
