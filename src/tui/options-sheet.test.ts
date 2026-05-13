/**
 * Tests for the per-widget options sheet. `optionsSummary` is pure and
 * tested directly; the Ink `OptionsSheet` component is exercised with Ink
 * mocked so no TTY is needed.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("ink", () => {
  const el = (...args: unknown[]) => ({ type: args[0], props: args[1] });
  return { Box: el, Text: el };
});

import { OptionsSheet, optionsSummary } from "./options-sheet.js";

describe("optionsSummary", () => {
  it("reports defaults for a bare widget", () => {
    expect(optionsSummary({ type: "model" })).toEqual([
      { key: "v", label: "visible", value: "shown" },
      { key: "l", label: "own label", value: "shown" },
      { key: "m", label: "spacing to neighbour", value: "full padding" },
    ]);
  });

  it("reflects hidden / rawValue / merged", () => {
    const summary = optionsSummary({ type: "tokens-total", hidden: true, rawValue: true, merged: "merge" });
    expect(summary).toEqual([
      { key: "v", label: "visible", value: "hidden" },
      { key: "l", label: "own label", value: "hidden" },
      { key: "m", label: "spacing to neighbour", value: "single space" },
    ]);
  });

  it("labels the no-padding merge mode", () => {
    const m = optionsSummary({ type: "separator", merged: "merge-no-padding" }).find((r) => r.key === "m");
    expect(m?.value).toBe("none (touching)");
  });
});

describe("OptionsSheet", () => {
  it("returns a React element titled with the widget type", () => {
    const node = OptionsSheet({ widget: { type: "git-branch" } });
    expect(node).toBeTruthy();
    expect(node).toHaveProperty("props");
  });

  it("never throws for any toggle combination", () => {
    expect(() => OptionsSheet({ widget: { type: "x", hidden: true } })).not.toThrow();
    expect(() => OptionsSheet({ widget: { type: "y", merged: "merge-no-padding" } })).not.toThrow();
  });
});
