import { describe, expect, it } from "vitest";

import type { LineConfig } from "../config/types.js";

import {
  currentWidget,
  initialState,
  reduce,
  type EditorState,
} from "./state.js";

const makeState = (widgets: { type: string; hidden?: boolean }[] = []): EditorState => {
  const lines: LineConfig[] = [{ widgets: widgets.map((w) => ({ ...w })) }];
  return initialState(lines);
};

describe("initialState", () => {
  it("ensures at least one line", () => {
    const s = initialState([]);
    expect(s.lines).toHaveLength(1);
    expect(s.cursor).toEqual({ line: 0, widget: -1 });
  });

  it("selects the first widget when one exists", () => {
    const s = initialState([{ widgets: [{ type: "model" }, { type: "clock" }] }]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(s.dirty).toBe(false);
  });
});

describe("reduce: navigate", () => {
  it("moves the cursor forward without exceeding the last widget", () => {
    let s = makeState([{ type: "a" }, { type: "b" }, { type: "c" }]);
    s = reduce(s, { type: "navigate", delta: 1 });
    expect(s.cursor.widget).toBe(1);
    s = reduce(s, { type: "navigate", delta: 5 });
    expect(s.cursor.widget).toBe(2);
  });

  it("clamps backwards at zero", () => {
    let s = makeState([{ type: "a" }, { type: "b" }]);
    s = reduce(s, { type: "navigate", delta: -10 });
    expect(s.cursor.widget).toBe(0);
  });

  it("is a no-op on an empty line", () => {
    const s = makeState([]);
    expect(reduce(s, { type: "navigate", delta: 1 })).toBe(s);
  });
});

describe("reduce: add", () => {
  it("appends to an empty line and selects the new widget", () => {
    let s = makeState([]);
    s = reduce(s, { type: "add", widgetType: "clock" });
    expect(s.lines[0]?.widgets).toEqual([{ type: "clock" }]);
    expect(s.cursor.widget).toBe(0);
    expect(s.dirty).toBe(true);
  });

  it("inserts after the current cursor", () => {
    let s = makeState([{ type: "a" }, { type: "c" }]);
    expect(s.cursor.widget).toBe(0);
    s = reduce(s, { type: "add", widgetType: "b" });
    const types = s.lines[0]?.widgets.map((w) => w.type) ?? [];
    expect(types).toEqual(["a", "b", "c"]);
    expect(s.cursor.widget).toBe(1);
  });

  it("ignores empty type", () => {
    const s = makeState([{ type: "a" }]);
    expect(reduce(s, { type: "add", widgetType: "" })).toBe(s);
  });
});

describe("reduce: delete", () => {
  it("removes the current widget and re-anchors the cursor", () => {
    let s = makeState([{ type: "a" }, { type: "b" }, { type: "c" }]);
    s = reduce(s, { type: "navigate", delta: 1 });
    s = reduce(s, { type: "delete" });
    const types = s.lines[0]?.widgets.map((w) => w.type) ?? [];
    expect(types).toEqual(["a", "c"]);
    expect(s.cursor.widget).toBe(1);
    expect(s.dirty).toBe(true);
  });

  it("clamps cursor to last widget when removing the tail", () => {
    let s = makeState([{ type: "a" }, { type: "b" }]);
    s = reduce(s, { type: "navigate", delta: 1 });
    s = reduce(s, { type: "delete" });
    expect(s.cursor.widget).toBe(0);
  });

  it("collapses to widget=-1 when the line becomes empty", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "delete" });
    expect(s.cursor.widget).toBe(-1);
    expect(s.lines[0]?.widgets).toEqual([]);
  });
});

describe("reduce: toggle / cycle", () => {
  it("toggle-hidden flips the hidden flag", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "toggle-hidden" });
    expect(s.lines[0]?.widgets[0]?.hidden).toBe(true);
    s = reduce(s, { type: "toggle-hidden" });
    expect(s.lines[0]?.widgets[0]?.hidden).toBe(false);
  });

  it("toggle-raw flips rawValue", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "toggle-raw" });
    expect(s.lines[0]?.widgets[0]?.rawValue).toBe(true);
  });

  it("cycle-merge walks off → merge → merge-no-padding → off", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "cycle-merge" });
    expect(s.lines[0]?.widgets[0]?.merged).toBe("merge");
    s = reduce(s, { type: "cycle-merge" });
    expect(s.lines[0]?.widgets[0]?.merged).toBe("merge-no-padding");
    s = reduce(s, { type: "cycle-merge" });
    expect(s.lines[0]?.widgets[0]?.merged).toBe("off");
  });

  it("set-type rewrites the widget type", () => {
    let s = makeState([{ type: "model" }]);
    s = reduce(s, { type: "set-type", widgetType: "clock" });
    expect(s.lines[0]?.widgets[0]?.type).toBe("clock");
    expect(s.dirty).toBe(true);
  });

  it("mark-clean drops the dirty flag", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "toggle-hidden" });
    expect(s.dirty).toBe(true);
    s = reduce(s, { type: "mark-clean" });
    expect(s.dirty).toBe(false);
  });
});

describe("currentWidget", () => {
  it("returns the selected widget", () => {
    const s = makeState([{ type: "a" }, { type: "b" }]);
    expect(currentWidget(s)?.type).toBe("a");
  });

  it("returns undefined when no widget is selected", () => {
    expect(currentWidget(makeState([]))).toBeUndefined();
  });
});
