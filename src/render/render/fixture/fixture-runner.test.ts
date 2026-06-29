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

import { DEFAULT_CONFIG } from "../../../data/config/defaults/defaults.js";
import type { AgentlineConfig } from "../../../data/config/types.js";
import type { GitState } from "../../../data/git/index.js";

import { renderForFixture } from "./fixture-runner.js";

const ESC = "\x1b[";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_THEMES_DIR = path.resolve(here, "..", "..", "..", "..", "themes");

const STDIN = JSON.stringify({ model: "claude-opus-4-7" });

/*
 * `git-branch` is a state-signal widget (`fg = resolveRole(theme,
 * "git-clean" | "git-dirty")`), so the family accent does NOT override
 * its colour — making it the right probe for "is the theme palette
 * flowing through the pipeline?" now that non-signal widgets take the
 * family accent. A clean injected snapshot pins the role to `git-clean`
 * deterministically (no dependency on the test host's working tree).
 */
const CLEAN_GIT: GitState = {
  available: true,
  cwd: "/repo",
  branch: "main",
  detached: false,
  sha: "0".repeat(40),
  shortSha: "0000000",
  status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 0 },
  diff: { insertions: 0, deletions: 0, filesChanged: 0 },
  diffStaged: { insertions: 0, deletions: 0, filesChanged: 0 },
  aheadBehind: { ahead: 0, behind: 0 },
  upstream: null,
  origin: null,
  upstreamRemote: null,
  worktreeName: null,
  inWorktree: false,
  pr: null,
  prSource: null,
};

/*
 * Lock the env so colour-depth detection is deterministic across hosts —
 * truecolor lets us assert the exact `38;2;R;G;B` sequence per palette.
 */
const TRUECOLOR_ENV = { COLORTERM: "truecolor", TERM: "xterm-256color" };

function configWithTheme(name: string | null): AgentlineConfig {
  return { ...DEFAULT_CONFIG, theme: name, lines: [{ widgets: [{ type: "git-branch" }] }] };
}

describe("renderForFixture — theming", () => {
  it("applies a named theme loaded from the bundled themes/ dir", async () => {
    const out = await renderForFixture(STDIN, {
      config: configWithTheme("claude-code-dark"),
      git: CLEAN_GIT,
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // claude-code-dark `git-clean` is #a3d088 → rgb(163, 208, 136).
    expect(out).toContain(`${ESC}38;2;163;208;136m`);
    // The widget value itself is preserved.
    expect(out).toContain("main");
  });

  it("falls back to the default palette when config.theme is null", async () => {
    const out = await renderForFixture(STDIN, {
      config: configWithTheme(null),
      git: CLEAN_GIT,
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // DEFAULT_PALETTE["git-clean"] is #9ece6a → rgb(158, 206, 106).
    expect(out).toContain(`${ESC}38;2;158;206;106m`);
  });

  it("falls back silently when config.theme names an unknown theme (never throws)", async () => {
    const out = await renderForFixture(STDIN, {
      config: configWithTheme("does-not-exist"),
      git: CLEAN_GIT,
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // Default palette stays in effect; never throws.
    expect(out).toContain(`${ESC}38;2;158;206;106m`);
  });

  it("honours an explicit options.theme = null (e.g. golden fixtures)", async () => {
    /*
     * Even though config.theme names a real theme, an explicit `null` opts
     * out of resolution — the path goldens use to keep their fixtures
     * byte-stable regardless of what's on the search path.
     */
    const out = await renderForFixture(STDIN, {
      config: configWithTheme("claude-code-dark"),
      theme: null,
      git: CLEAN_GIT,
      builtinThemesDir: SHIPPED_THEMES_DIR,
      env: TRUECOLOR_ENV,
      frozenClockISO: "2026-05-12T14:30:00.000Z",
      width: 80,
    });
    // Default palette, not claude-code-dark.
    expect(out).toContain(`${ESC}38;2;158;206;106m`);
    expect(out).not.toContain(`${ESC}38;2;127;176;105m`);
  });
});
