import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { LineConfig } from "../config/types.js";
import type { GitState } from "../git/index.js";
import { resetPreviewModeCache, setPreviewModeForTesting } from "../render/preview-fixture.js";
import { PRICING_TABLE_VERSION, contextWindowFor, type TokensSnapshot } from "../tokens/index.js";

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
  pricingVersion: PRICING_TABLE_VERSION,
});

// Pin a real-mode preview context so tests that depend on widgets
// rendering "main", "Opus 4.7" etc. don't fall through to label mode.
beforeEach(() => {
  setPreviewModeForTesting({
    kind: "real",
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
            { type: "clock", merged: "merge-no-padding" },
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

  it("surfaces a self-hiding widget (no data right now) with the widget's type name as fallback", () => {
    // `git-worktree` hides cleanly when `inWorktree === false` — the
    // demo session is a plain checkout, so its preview falls back to
    // the widget's type name (dimmed) instead of a decorative chip.
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "git-worktree" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.text).toBe("git-worktree");
    expect(widget?.kind === "widget" && widget.hidden).toBe(true);
  });

  it("does not mutate the supplied lines", () => {
    const lines: LineConfig[] = [{ widgets: [{ type: "model" }] }];
    const snapshot = JSON.stringify(lines);
    buildPreview({ base: DEFAULT_CONFIG, lines });
    expect(JSON.stringify(lines)).toBe(snapshot);
  });

  it("widget slots carry the resolved colour (from the widget's Cell)", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    // `model` uses `resolveRole(theme, "accent")` — with `theme: null` it
    // falls back to DEFAULT_PALETTE.accent (#7aa2f7).
    expect(widget?.kind === "widget" && widget.fg).toBe("#7aa2f7");
  });

  it("widget overrides win over the widget's own Cell colours", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", fg: "#ff0080" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.fg).toBe("#ff0080");
  });
});

describe("buildPreview — label-only fallback (no stdin cache)", () => {
  it("renders every widget as its type name when no cached stdin is available", () => {
    setPreviewModeForTesting({ kind: "label" });
    const rows = buildPreview({
      base: { ...DEFAULT_CONFIG, glyphs: "off" },
      lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }] }],
    });
    const widgets = rows[0]?.slots.filter((s) => s.kind === "widget") ?? [];
    expect(widgets).toHaveLength(2);
    if (widgets[0]?.kind === "widget") expect(widgets[0].text).toBe("model");
    if (widgets[1]?.kind === "widget") expect(widgets[1].text).toBe("git-branch");
  });
});

// Use the helper in one assertion to keep it referenced; the rest of the
// tests inspect individual slots directly.
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
