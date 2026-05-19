import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/defaults.js";
import type { LineConfig } from "../../data/config/types.js";
import type { GitState } from "../../data/git/index.js";
import { DEFAULT_PALETTE, type Theme } from "../../data/theme/index.js";
import { resetPreviewModeCache, setPreviewModeForTesting } from "./preview-fixture.js";
import { contextWindowFor, type TokensSnapshot } from "../../data/tokens/index.js";

import { buildPreview, type PreviewRow } from "./preview-model.js";

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
});

const realTokens: TokensSnapshot = Object.freeze({
  events: Object.freeze([]) as TokensSnapshot["events"],
  now: Date.parse("2026-05-13T11:00:00.000Z"),
  contextWindow: contextWindowFor("claude-opus-4-7"),
});

/*
 * Pin a real-mode preview context so tests that depend on widgets
 * rendering "main", "Opus 4.7" etc. don't fall through to label mode.
 */
beforeEach(() => {
  setPreviewModeForTesting({
    source: "cache",
    payload: {
      raw: {},
      truncated: false,
      model: "claude-opus-4-7",
      cwd: "/agentline",
    },
    session: { model: "claude-opus-4-7" },
    tokens: realTokens,
    git: realGit,
  });
});

afterEach(() => {
  resetPreviewModeCache();
});

function rowSlots(row: PreviewRow): string[] {
  return row.slots.map((s) => (s.kind === "add" ? "+" : s.text));
}

/*
 * Colours are pre-resolved through the bin's colour model at the
 * env-detected depth (preview-model.ts `toHex`). Tests that assert a
 * concrete chip colour pass a truecolor env so the resolved RGB is the
 * colour's exact swatch; an empty env detects "none" (no colour).
 */
const TRUECOLOR: NodeJS.ProcessEnv = { COLORTERM: "truecolor" };

describe("buildPreview", () => {
  it("emits one row per supplied line", () => {
    const lines: LineConfig[] = [
      { widgets: [{ type: "model" }] },
      { widgets: [] },
      { widgets: [{ type: "git-branch" }] },
    ];
    const rows = buildPreview({ base: DEFAULT_CONFIG, lines });
    expect(rows).toHaveLength(3);
    expect(rows[0]?.line).toBe(0);
    expect(rows[2]?.line).toBe(2);
  });

  it("appends a single trailing add-cell to every row", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }] }, { widgets: [] }],
    });
    for (const row of rows) {
      const lastSlot = row.slots[row.slots.length - 1];
      expect(lastSlot?.kind).toBe("add");
    }
  });

  it("an empty row contains only the add-cell at column 0", () => {
    const rows = buildPreview({ base: DEFAULT_CONFIG, lines: [{ widgets: [] }] });
    expect(rows[0]?.slots).toHaveLength(1);
    expect(rows[0]?.slots[0]).toEqual({ kind: "add", column: 0 });
    expect(rows[0]?.widgetCount).toBe(0);
  });

  it("widget slots carry their index, text, and the resolved cell text", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }] }],
    });
    const row = rows[0]!;
    expect(row.widgetCount).toBe(2);
    const widgets = row.slots.filter((s) => s.kind === "widget");
    expect(widgets).toHaveLength(2);
    if (widgets[0]?.kind === "widget") {
      expect(widgets[0].widgetIndex).toBe(0);
      expect(widgets[0].text).toContain("Opus 4.7");
    }
    if (widgets[1]?.kind === "widget") {
      expect(widgets[1].widgetIndex).toBe(1);
      expect(widgets[1].text).toContain("main");
    }
  });

  it("inserts the configured separator (with padding) between widgets, by default", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }] }],
    });
    // DEFAULT_CONFIG has separator "|" and padding 1, merged "off".
    const joins = rows[0]?.slots.filter((s) => s.kind === "join") ?? [];
    expect(joins).toHaveLength(1);
    expect(joins[0]?.kind === "join" && joins[0].text).toBe(" | ");
  });

  it("honours per-widget merge=merge (single space) and merge-no-padding (empty)", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [
        {
          widgets: [
            { type: "model" },
            { type: "git-branch", merged: "merge" },
            { type: "version", merged: "merge-no-padding" },
          ],
        },
      ],
    });
    const joins = rows[0]?.slots.filter((s) => s.kind === "join") ?? [];
    expect(joins).toHaveLength(1); // merge-no-padding suppresses its own join
    expect(joins[0]?.kind === "join" && joins[0].text).toBe(" ");
  });

  it("renders a hidden widget as a navigable dimmed chip showing its type name", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", hidden: true }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.hidden).toBe(true);
    expect(widget?.kind === "widget" && widget.text).toBe("model");
  });

  it("surfaces a self-hiding widget (no data right now) as a family-branded dim stub", () => {
    /*
     * `git-worktree` hides cleanly when `inWorktree === false`. The stub
     * now carries the family glyph prefix and family accent colour so the
     * user can still identify which widget is there while it remains dimmed.
     */
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      env: TRUECOLOR,
      lines: [{ widgets: [{ type: "git-worktree" }] }],
    });
    const w = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(w?.kind === "widget" && w.hidden).toBe(true);
    // text carries the family glyph prefix — "git-worktree" appears as suffix
    expect(w?.kind === "widget" && w.text).toContain("git-worktree");
    // family accent is forwarded to the slot, resolved to the git
    // family's green swatch (#0dbc79)
    expect(w?.kind === "widget" && w.fg).toBe("#0dbc79");
  });

  it("does not mutate the supplied lines", () => {
    const lines: LineConfig[] = [{ widgets: [{ type: "model" }] }];
    const snapshot = JSON.stringify(lines);
    buildPreview({ base: DEFAULT_CONFIG, lines });
    expect(JSON.stringify(lines)).toBe(snapshot);
  });

  it("a non-signal chip uses its family accent, theme-independent, matching the live render", () => {
    /*
     * `model` is a non-signal widget: family colour is the single
     * source of truth for its accent, so it shows the `session`
     * family colour ("blue") regardless of theme — exactly what the
     * live render now prints (preview == render).
     */
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      env: TRUECOLOR,
      lines: [{ widgets: [{ type: "model" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    // session family "blue" resolved through the bin's palette
    expect(widget?.kind === "widget" && widget.fg).toBe("#2472c8");
  });

  it("a signal widget reflects the configured theme role, exactly as the live render", () => {
    /*
     * `git-branch` is a state-signal widget (clean/dirty). The demo
     * git snapshot is clean, so it resolves the theme's `git-clean`
     * role — the family accent does NOT override a signal colour, and
     * the preview matches the live render byte-for-byte.
     */
    const theme: Theme = {
      name: "test-theme",
      palette: { ...DEFAULT_PALETTE, "git-clean": "#cc785c" },
      powerline: { capsStart: "", capsEnd: "" },
      source: "file",
    };
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      theme,
      env: TRUECOLOR,
      lines: [{ widgets: [{ type: "git-branch" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.fg).toBe("#cc785c");
  });

  it("widget overrides win over the theme colour", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      env: TRUECOLOR,
      lines: [{ widgets: [{ type: "model", fg: "#ff0080" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.fg).toBe("#ff0080");
  });

  it("pre-resolves the chip colour at the env-detected depth (preview == live)", () => {
    /*
     * `model`'s accent is the session family colour "blue". The bin maps
     * named colours through its own fixed palette, so a 16-colour
     * terminal still shows the bin's blue swatch — not the terminal's
     * own — and `NO_COLOR` / no TERM yields an uncoloured chip exactly
     * as the live render would.
     */
    const at = (env: NodeJS.ProcessEnv): string | undefined => {
      const rows = buildPreview({
        base: DEFAULT_CONFIG,
        env,
        lines: [{ widgets: [{ type: "model" }] }],
      });
      const w = rows[0]?.slots.find((s) => s.kind === "widget");
      return w?.kind === "widget" ? w.fg : undefined;
    };
    expect(at({ COLORTERM: "truecolor" })).toBe("#2472c8");
    expect(at({ TERM: "xterm-256color" })).toBe("#2472c8");
    expect(at({ TERM: "xterm" })).toBe("#2472c8");
    expect(at({})).toBeUndefined(); // no TERM → "none"
    expect(at({ COLORTERM: "truecolor", NO_COLOR: "1" })).toBeUndefined();
  });
});

describe("buildPreview — self-hide fallback (no data for the widget)", () => {
  it("keeps data-less widgets as dim family-glyph + type-name chips", () => {
    /*
     * Real context, but nothing this session can populate `model` or
     * `git-branch` with. They must still appear (hidden:true → dimmed by
     * the renderer) carrying the family glyph + type name, never vanish.
     */
    setPreviewModeForTesting({
      source: "cache",
      payload: { raw: {}, truncated: false },
      session: {},
      tokens: realTokens,
      git: { available: false },
    });
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }] }],
    });
    const widgets = rows[0]?.slots.filter((s) => s.kind === "widget") ?? [];
    expect(widgets).toHaveLength(2);
    if (widgets[0]?.kind === "widget") {
      expect(widgets[0].text).toBe("⌂ model");
      expect(widgets[0].hidden).toBe(true);
    }
    if (widgets[1]?.kind === "widget") {
      expect(widgets[1].text).toBe("⎇ git-branch");
      expect(widgets[1].hidden).toBe(true);
    }
  });
});

/*
 * Use the helper in one assertion to keep it referenced; the rest of the
 * tests inspect individual slots directly.
 */
describe("buildPreview — row slot summary", () => {
  it("yields slots in order: w0 join w1 join w2 + (with default joins)", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "a" }, { type: "b" }, { type: "c" }] }],
    });
    const summary = rowSlots(rows[0]!);
    expect(summary).toHaveLength(6); // 3 widgets + 2 joins + 1 add
    expect(summary[summary.length - 1]).toBe("+");
  });
});
