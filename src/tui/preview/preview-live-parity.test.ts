/**
 * Preview↔live parity guard (agentline-153).
 *
 * The regression PR #153 fixed: the editor preview resolved widget
 * colours through a different path than the live statusline, so a chip's
 * `fg` came back `undefined` and Ink fell back to a generic family accent
 * while the bin painted the real theme colour. This test pins the two
 * paths together.
 *
 * Ground truth = the live statusline's own per-widget render: the exact
 * `buildWidgetContext` + `renderWidget` call `renderFromInputs` makes for
 * every configured widget, with the cell colour pushed through the bin's
 * own colour model (`resolveColourRgb`) at the env-detected depth — i.e.
 * the hex the ANSI encoder would actually emit. The preview side is
 * `buildPreview`. For every widget the slot must agree with the live
 * render on text, resolved fg, and hidden — across a non-signal family
 * accent, a theme-role signal colour, and a per-widget override.
 */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import type { WidgetConfig } from "../../data/config/types.js";
import type { GitState } from "../../data/git/index.js";
import { effectiveDepth, honourNoColorEnv } from "../../render/render/accessibility/accessibility.js";
import { resolveColourRgb } from "../../render/render/ansi/ansi.js";
import { buildWidgetContext } from "../../render/render/context.js";
import { detectColourDepth, type ColourDepth } from "../../render/render/colour-depth/colour-depth.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import { DEFAULT_PALETTE, type Theme } from "../../data/theme/index.js";
import type { Colour } from "../../data/theme/colours/colours.js";
import { contextWindowFor, type TokensSnapshot } from "../../data/tokens/index.js";
import { realClock } from "../../widgets/clock/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../../widgets/index.js";
import { renderWidget } from "../../widgets/render-widget/render-widget.js";

import { resetPreviewModeCache, setPreviewModeForTesting } from "./preview-fixture.js";
import { buildPreview, type PreviewSlot } from "./preview-model.js";

const realGit: GitState = Object.freeze({
  available: true,
  cwd: "/agentline",
  branch: "main",
  detached: false,
  sha: "0".repeat(40),
  shortSha: "0000000",
  status: Object.freeze({
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicts: 0,
    modified: 0,
    added: 0,
  }),
  diff: Object.freeze({ insertions: 0, deletions: 0, filesChanged: 0 }),
  diffStaged: Object.freeze({ insertions: 0, deletions: 0, filesChanged: 0 }),
  aheadBehind: Object.freeze({ ahead: 0, behind: 0 }),
  upstream: null,
  origin: null,
  upstreamRemote: null,
  worktreeName: null,
  inWorktree: false,
  pr: null,
  prSource: null,
});

const realTokens: TokensSnapshot = Object.freeze({
  events: Object.freeze([]) as TokensSnapshot["events"],
  now: Date.parse("2026-05-13T11:00:00.000Z"),
  contextWindow: contextWindowFor("claude-opus-4-7"),
});

const payload: StdinPayload = {
  raw: {},
  truncated: false,
  model: "claude-opus-4-7",
  cwd: "/agentline",
  contextWindow: { usedTokens: 180_000, windowSize: 1_000_000 },
};

/*
 * A theme whose `git-clean` role is distinct from any family accent, so
 * the signal-colour assertion fails loudly if the preview ever stops
 * threading the resolved Theme (the exact PR #153 break).
 */
const theme: Theme = {
  name: "parity-theme",
  palette: { ...DEFAULT_PALETTE, "git-clean": "#cc785c" },
  powerline: { capsStart: "", capsEnd: "" },
  source: "file",
};

/** Mirror of preview-model.ts `resolveDepth` — the bin's own inputs. */
function resolveDepth(env: NodeJS.ProcessEnv): ColourDepth {
  return effectiveDepth(
    detectColourDepth({ env }),
    honourNoColorEnv({ noColor: false, noUnicode: false }, env),
  );
}

/** Mirror of preview-model.ts `toHex` — what the bin actually paints. */
function toHex(c: Colour | undefined, depth: ColourDepth): string | undefined {
  if (c === undefined) return undefined;
  const rgb = resolveColourRgb(c, depth);
  if (rgb === null) return undefined;
  const h = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

function registry(): ReturnType<typeof defaultRegistry> {
  const r = defaultRegistry();
  if (r.size() === 0) registerAllBuiltins(r);
  return r;
}

/** The live statusline's per-widget render — `renderFromInputs`' inner loop. */
function liveCell(widget: WidgetConfig, env: NodeJS.ProcessEnv) {
  const ctx = buildWidgetContext({
    payload,
    config: DEFAULT_CONFIG,
    theme,
    clock: realClock,
    env,
    tokens: realTokens,
    git: realGit,
    session: { model: "claude-opus-4-7" },
  });
  return renderWidget(registry(), widget, ctx);
}

function widgetSlots(env: NodeJS.ProcessEnv, widgets: WidgetConfig[]): PreviewSlot[] {
  setPreviewModeForTesting({
    source: "cache",
    payload,
    session: { model: "claude-opus-4-7" },
    tokens: realTokens,
    git: realGit,
  });
  const rows = buildPreview({ base: DEFAULT_CONFIG, theme, env, lines: [{ widgets }] });
  return (rows[0]?.slots ?? []).filter((s): s is PreviewSlot => s.kind === "widget");
}

afterEach(() => {
  resetPreviewModeCache();
});

describe("preview↔live parity", () => {
  const env: NodeJS.ProcessEnv = { COLORTERM: "truecolor" };
  const widgets: WidgetConfig[] = [
    { type: "context-percentage" }, // accepted resolveContextUsage path, family accent
    { type: "model" }, // non-signal family accent
    { type: "git-branch" }, // signal → theme role git-clean
    { type: "model", fg: "#ff0080" }, // per-widget override wins
  ];

  it("every chip matches the live render's text, resolved fg, and hidden state", () => {
    const depth = resolveDepth(env);
    const slots = widgetSlots(env, widgets);
    expect(slots).toHaveLength(widgets.length);

    widgets.forEach((widget, i) => {
      const slot = slots[i];
      if (slot?.kind !== "widget") throw new Error(`slot ${i} is not a widget`);
      const live = liveCell(widget, env);

      // None of the chosen widgets self-hide with this pinned data.
      expect(live.hidden ?? false).toBe(false);
      expect(slot.hidden).toBe(false);
      expect(slot.text).toBe(live.text);
      expect(slot.fg).toBe(toHex(widget.fg ?? live.fg, depth));
    });
  });

  it("anchors the concrete colours PR #153 regressed (no vacuous undefined==undefined pass)", () => {
    const slots = widgetSlots(env, widgets);

    // git-branch is a clean signal → the threaded theme's git-clean role.
    const gitBranch = slots[2];
    expect(gitBranch?.kind === "widget" && gitBranch.fg).toBe("#cc785c");

    // The per-widget override survives end to end.
    const overridden = slots[3];
    expect(overridden?.kind === "widget" && overridden.fg).toBe("#ff0080");

    // Family-accent chips resolve to a real swatch, not undefined.
    for (const i of [0, 1]) {
      const s = slots[i];
      expect(s?.kind === "widget" && typeof s.fg).toBe("string");
    }
  });

  it("preview and live degrade together when colour is off (depth = none)", () => {
    const noColorEnv: NodeJS.ProcessEnv = {}; // no TERM → depth "none"
    const depth = resolveDepth(noColorEnv);
    const slots = widgetSlots(noColorEnv, widgets);

    widgets.forEach((widget, i) => {
      const slot = slots[i];
      if (slot?.kind !== "widget") throw new Error(`slot ${i} is not a widget`);
      const live = liveCell(widget, noColorEnv);
      expect(slot.text).toBe(live.text);
      // Both sides drop colour identically — matches a no-colour live render.
      expect(slot.fg).toBeUndefined();
      expect(toHex(widget.fg ?? live.fg, depth)).toBeUndefined();
    });
  });
});
