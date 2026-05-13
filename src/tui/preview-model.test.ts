import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import type { LineConfig } from "../config/types.js";

import { buildPreview, type PreviewRow } from "./preview-model.js";

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

  it("renders a hidden widget as a navigable [hidden:type] chip with hidden=true", () => {
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", hidden: true }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.hidden).toBe(true);
    expect(widget?.kind === "widget" && widget.text).toBe("[hidden:model]");
  });

  it("surfaces a self-hiding widget (no data in the demo session) as a [type: no data] chip", () => {
    // `git-conflicts` hides cleanly when conflicts === 0 — the demo
    // session has none, so its preview surfaces a "no data" chip.
    const rows = buildPreview({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "git-conflicts" }] }],
    });
    const widget = rows[0]?.slots.find((s) => s.kind === "widget");
    expect(widget?.kind === "widget" && widget.text).toContain("no data");
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
