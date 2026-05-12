/**
 * Tests for the editor's live-preview region. `previewLines` is pure and
 * tested directly; the Ink `Preview` component is exercised with Ink mocked
 * so we never need a TTY.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const el = (...args: unknown[]) => ({ type: args[0], props: args[1] });
  return { Box: el, Text: el };
});

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { Preview, previewLines } from "./preview.js";

describe("previewLines", () => {
  it("renders the loaded config's widgets against the demo session", () => {
    const rows = previewLines({ base: DEFAULT_CONFIG, lines: DEFAULT_CONFIG.lines });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // DEFAULT_CONFIG ships just the `model` widget.
    expect(rows.join("\n")).toContain("Opus 4.7");
  });

  it("reflects the editor's current line list, not the base's", () => {
    const rows = previewLines({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "git-branch" }, { type: "separator", options: { char: " | " } }, { type: "model" }] }],
    });
    expect(rows.join("\n")).toContain("main");
    expect(rows.join("\n")).toContain("Opus 4.7");
  });

  it("yields one row per configured line", () => {
    const rows = previewLines({
      base: DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model" }] }, { widgets: [{ type: "git-branch" }] }],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Opus 4.7");
    expect(rows[1]).toContain("main");
  });

  it("returns a single empty row for an all-empty config", () => {
    expect(previewLines({ base: DEFAULT_CONFIG, lines: [{ widgets: [] }] })).toEqual([""]);
  });

  it("does not mutate the supplied lines", () => {
    const lines = [{ widgets: [{ type: "model" as const }] }];
    const snapshot = JSON.stringify(lines);
    previewLines({ base: DEFAULT_CONFIG, lines });
    expect(JSON.stringify(lines)).toBe(snapshot);
  });
});

describe("Preview", () => {
  it("returns a React element", () => {
    const node = Preview({ base: DEFAULT_CONFIG, lines: DEFAULT_CONFIG.lines, width: 80 });
    expect(node).toBeTruthy();
    expect(node).toHaveProperty("props");
  });
});
