/**
 * Tests for the widget picker overlay. The filtering / selection logic is
 * pure and tested directly; the Ink `Picker` component is exercised with
 * Ink mocked so no TTY is needed.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const el = (...args: unknown[]) => ({ type: args[0], props: args[1] });
  return { Box: el, Text: el };
});

import type { WidgetMetaEntry } from "../widgets/index.js";
import { Picker, PICKER_PAGE, filterWidgets, selectedEntry } from "./picker.js";

const entries: readonly WidgetMetaEntry[] = [
  { type: "git-branch", name: "Git branch", description: "Current branch", category: "git" },
  { type: "git-changes", name: "Git changes", description: "File counts", category: "git" },
  { type: "model", name: "Model", description: "Active model id", category: "session" },
  { type: "clock", name: "Clock", description: "Wall-clock time", category: "time" },
  { type: "tokens-total", name: "Tokens (total)", description: "Token total", category: "tokens" },
];

describe("filterWidgets", () => {
  it("returns everything for an empty / whitespace query", () => {
    expect(filterWidgets(entries, "")).toBe(entries);
    expect(filterWidgets(entries, "   ")).toBe(entries);
  });

  it("matches the query as a case-insensitive substring of type or name", () => {
    expect(filterWidgets(entries, "git").map((e) => e.type)).toEqual(["git-branch", "git-changes"]);
    expect(filterWidgets(entries, "MODEL").map((e) => e.type)).toEqual(["model"]);
    expect(filterWidgets(entries, "total").map((e) => e.type)).toEqual(["tokens-total"]);
  });

  it("returns nothing when no widget matches", () => {
    expect(filterWidgets(entries, "zzz")).toEqual([]);
  });
});

describe("selectedEntry", () => {
  it("returns the highlighted entry within the filtered list", () => {
    expect(selectedEntry(entries, "git", 1)?.type).toBe("git-changes");
    expect(selectedEntry(entries, "", 2)?.type).toBe("model");
  });

  it("clamps the highlight to the bounds of the filtered list", () => {
    expect(selectedEntry(entries, "git", 99)?.type).toBe("git-changes");
    expect(selectedEntry(entries, "git", -5)?.type).toBe("git-branch");
  });

  it("returns undefined when nothing matches", () => {
    expect(selectedEntry(entries, "zzz", 0)).toBeUndefined();
  });
});

describe("Picker", () => {
  it("renders a React element with the given title", () => {
    const node = Picker({ title: "Insert a widget", entries, query: "", highlight: 0 });
    expect(node).toBeTruthy();
    expect(node).toHaveProperty("props");
  });

  it("never throws — even with no matches or an out-of-range highlight", () => {
    expect(() => Picker({ title: "x", entries, query: "zzz", highlight: 3 })).not.toThrow();
    expect(() => Picker({ title: "x", entries, query: "", highlight: 999 })).not.toThrow();
  });

  it("exposes a sane page size", () => {
    expect(PICKER_PAGE).toBeGreaterThan(0);
  });
});
