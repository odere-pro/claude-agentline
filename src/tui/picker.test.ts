/**
 * Tests for the three-step widget picker. The filtering / selection helpers
 * are pure and tested directly; the Ink components are exercised with Ink
 * mocked so no TTY is needed.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const el = (...args: unknown[]) => ({ type: args[0], props: args[1] });
  return { Box: el, Text: el };
});

import type { WidgetMetaEntry } from "../widgets/index.js";

import { pickGlyphs } from "./glyphs.js";
import {
  PICKER_PAGE,
  PickerGroup,
  PickerSearch,
  PickerVariant,
  PickerWidget,
  categoriesWithWidgets,
  filterWidgets,
  selectedAt,
  variantRows,
  widgetsInCategory,
} from "./picker.js";

const ENTRIES: readonly WidgetMetaEntry[] = [
  { type: "git-branch", name: "Git branch", description: "branch", category: "git" },
  { type: "git-changes", name: "Git changes", description: "changes", category: "git" },
  { type: "model", name: "Model", description: "model id", category: "session" },
  { type: "skills", name: "Skills", description: "skills attached", category: "session" },
  { type: "clock", name: "Clock", description: "wall-clock", category: "time" },
];

const GLYPHS = pickGlyphs({ unicode: true });

describe("categoriesWithWidgets", () => {
  it("lists every category that has ≥1 widget, in catalogue order", () => {
    expect(categoriesWithWidgets(ENTRIES)).toEqual(["session", "git", "time"]);
  });

  it("returns empty when no entries are present", () => {
    expect(categoriesWithWidgets([])).toEqual([]);
  });
});

describe("widgetsInCategory", () => {
  it("scopes to the given category and substring-filters", () => {
    expect(widgetsInCategory(ENTRIES, "git", "").map((e) => e.type)).toEqual([
      "git-branch",
      "git-changes",
    ]);
    expect(widgetsInCategory(ENTRIES, "git", "BRANCH").map((e) => e.type)).toEqual(["git-branch"]);
    expect(widgetsInCategory(ENTRIES, "session", "skills").map((e) => e.type)).toEqual(["skills"]);
  });

  it("returns empty when nothing matches", () => {
    expect(widgetsInCategory(ENTRIES, "git", "zzz")).toEqual([]);
  });
});

describe("variantRows", () => {
  it('prefixes a "Default options" synthetic row in fresh mode', () => {
    const rows = variantRows("skills", "fresh");
    expect(rows[0]).toEqual({ id: null, label: "Default options" });
    expect(rows.slice(1).map((r) => r.id)).toEqual(["count", "list", "last"]);
  });

  it('prefixes a "Keep current options" synthetic row in update mode', () => {
    const rows = variantRows("skills", "update");
    expect(rows[0]).toEqual({ id: null, label: "Keep current options" });
  });

  it("widgets without variants get just the synthetic row", () => {
    expect(variantRows("git-branch", "fresh")).toEqual([{ id: null, label: "Default options" }]);
  });
});

describe("selectedAt", () => {
  it("returns the highlighted row, clamping to bounds", () => {
    expect(selectedAt([1, 2, 3], 1)).toBe(2);
    expect(selectedAt([1, 2, 3], -5)).toBe(1);
    expect(selectedAt([1, 2, 3], 99)).toBe(3);
  });

  it("returns undefined on empty input", () => {
    expect(selectedAt<number>([], 0)).toBeUndefined();
  });
});

describe("filterWidgets", () => {
  it("substring-matches over type and name across every category", () => {
    expect(filterWidgets(ENTRIES, "git").map((e) => e.type)).toEqual([
      "git-branch",
      "git-changes",
    ]);
    expect(filterWidgets(ENTRIES, "MODEL").map((e) => e.type)).toEqual(["model"]);
  });

  it("drops `exclude` types regardless of query", () => {
    const exclude = new Set(["model"]);
    expect(filterWidgets(ENTRIES, "", exclude).map((e) => e.type)).toEqual([
      "git-branch",
      "git-changes",
      "skills",
      "clock",
    ]);
    expect(filterWidgets(ENTRIES, "model", exclude)).toEqual([]);
  });
});

describe("PICKER_PAGE", () => {
  it("is a positive integer", () => {
    expect(PICKER_PAGE).toBeGreaterThan(0);
    expect(Number.isInteger(PICKER_PAGE)).toBe(true);
  });
});

describe("Picker components — smoke", () => {
  it("PickerGroup renders without throwing", () => {
    expect(() =>
      PickerGroup({ entries: ENTRIES, highlight: 0, glyphs: GLYPHS }),
    ).not.toThrow();
  });

  it("PickerWidget renders without throwing, even with an out-of-range highlight", () => {
    expect(() =>
      PickerWidget({ category: "git", entries: ENTRIES, query: "", highlight: 99 }),
    ).not.toThrow();
  });

  it("PickerWidget renders gracefully when nothing matches", () => {
    expect(() =>
      PickerWidget({ category: "git", entries: ENTRIES, query: "zzz", highlight: 0 }),
    ).not.toThrow();
  });

  it("PickerWidget includes each widget's description text in its row", () => {
    const node = PickerWidget({ category: "git", entries: ENTRIES, query: "", highlight: 0 });
    const serialised = JSON.stringify(node);
    // Both git widgets' descriptions from ENTRIES must appear in the
    // rendered tree (separate dim-coloured Text children).
    expect(serialised).toContain("branch");
    expect(serialised).toContain("changes");
  });

  it("PickerSearch renders flat results across categories filtered by query", () => {
    const node = PickerSearch({ entries: ENTRIES, query: "git", highlight: 0 });
    const serialised = JSON.stringify(node);
    expect(serialised).toContain("git-branch");
    expect(serialised).toContain("git-changes");
    // Out-of-query entries do not appear.
    expect(serialised).not.toContain("clock");
    // Each row carries its category badge.
    expect(serialised).toContain("[git");
  });

  it("PickerSearch hides excluded types", () => {
    const node = PickerSearch({
      entries: ENTRIES,
      query: "git",
      highlight: 0,
      exclude: new Set(["git-branch"]),
    });
    const serialised = JSON.stringify(node);
    expect(serialised).not.toContain("git-branch");
    expect(serialised).toContain("git-changes");
  });

  it("PickerSearch renders gracefully when nothing matches", () => {
    expect(() =>
      PickerSearch({ entries: ENTRIES, query: "zzz", highlight: 0 }),
    ).not.toThrow();
  });

  it("PickerVariant renders for a widget with variants and one without", () => {
    expect(() =>
      PickerVariant({ widgetType: "skills", mode: "fresh", highlight: 0 }),
    ).not.toThrow();
    expect(() =>
      PickerVariant({ widgetType: "git-branch", mode: "update", highlight: 0 }),
    ).not.toThrow();
  });
});
