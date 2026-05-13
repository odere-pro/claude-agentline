import { describe, expect, it } from "vitest";

import type { LineConfig, WidgetConfig } from "../config/types.js";

import {
  MAX_LINES,
  currentWidget,
  initialState,
  reduce,
  type EditorState,
} from "./state.js";

const makeState = (widgets: { type: string; hidden?: boolean }[] = []): EditorState => {
  const lines: LineConfig[] = [{ widgets: widgets.map((w) => ({ ...w })) }];
  return initialState(lines);
};

const multiLine = (rows: string[][]): EditorState =>
  initialState(rows.map((types) => ({ widgets: types.map((type): WidgetConfig => ({ type })) })));

const typesOf = (state: EditorState): string[][] =>
  state.lines.map((l) => l.widgets.map((w) => w.type));

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
    s = reduce(s, { type: "move-cursor", dx: 1 });
    s = reduce(s, { type: "delete" });
    const types = s.lines[0]?.widgets.map((w) => w.type) ?? [];
    expect(types).toEqual(["a", "c"]);
    expect(s.cursor.widget).toBe(1);
    expect(s.dirty).toBe(true);
  });

  it("clamps cursor to last widget when removing the tail", () => {
    let s = makeState([{ type: "a" }, { type: "b" }]);
    s = reduce(s, { type: "move-cursor", dx: 1 });
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

describe("initialState: multi-line", () => {
  it("trims to MAX_LINES", () => {
    const s = initialState([
      { widgets: [{ type: "a" }] },
      { widgets: [{ type: "b" }] },
      { widgets: [{ type: "c" }] },
      { widgets: [{ type: "d" }] },
    ]);
    expect(s.lines).toHaveLength(MAX_LINES);
    expect(typesOf(s)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("starts in edit mode with an insert-target picker", () => {
    const s = makeState([{ type: "a" }]);
    expect(s.mode).toBe("edit");
    expect(s.pickerTarget).toBe("insert");
  });
});

describe("reduce: move-cursor", () => {
  it("slides within a row with dx", () => {
    let s = multiLine([["a", "b", "c"], ["d"]]);
    s = reduce(s, { type: "move-cursor", dx: 2 });
    expect(s.cursor).toEqual({ line: 0, widget: 2 });
    s = reduce(s, { type: "move-cursor", dx: -5 });
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
  });

  it("moves to an adjacent row with dy, clamping the column", () => {
    let s = multiLine([["a", "b", "c"], ["d"]]);
    s = reduce(s, { type: "move-cursor", dx: 2 }); // → line 0, widget 2
    s = reduce(s, { type: "move-cursor", dy: 1 }); // → line 1, widget clamps to 0
    expect(s.cursor).toEqual({ line: 1, widget: 0 });
    s = reduce(s, { type: "move-cursor", dy: -1 }); // back to line 0, column 0
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
  });

  it("lands widget=-1 on an empty row", () => {
    let s = multiLine([["a"], []]);
    s = reduce(s, { type: "move-cursor", dy: 1 });
    expect(s.cursor).toEqual({ line: 1, widget: -1 });
  });

  it("is a no-op past the last row and is inert outside edit mode", () => {
    const s = multiLine([["a"]]);
    expect(reduce(s, { type: "move-cursor", dy: 1 })).toBe(s);
    const picking = reduce(s, { type: "open-picker", target: "insert" });
    expect(reduce(picking, { type: "move-cursor", dx: 1 })).toBe(picking);
  });
});

describe("reduce: move-widget", () => {
  it("shifts a widget within its row, cursor following", () => {
    let s = multiLine([["a", "b", "c"]]);
    s = reduce(s, { type: "move-widget", dx: 2 });
    expect(typesOf(s)).toEqual([["b", "c", "a"]]);
    expect(s.cursor).toEqual({ line: 0, widget: 2 });
    expect(s.dirty).toBe(true);
  });

  it("moves a widget to the adjacent row, appending there", () => {
    let s = multiLine([["a", "b"], ["c"]]);
    s = reduce(s, { type: "move-widget", dy: 1 }); // move "a" → end of line 1
    expect(typesOf(s)).toEqual([["b"], ["c", "a"]]);
    expect(s.cursor).toEqual({ line: 1, widget: 1 });
  });

  it("creates a new row when moving down off the last one", () => {
    let s = multiLine([["a", "b"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 }); // select "b"
    s = reduce(s, { type: "move-widget", dy: 1 });
    expect(typesOf(s)).toEqual([["a"], ["b"]]);
    expect(s.cursor).toEqual({ line: 1, widget: 0 });
  });

  it("refuses to exceed MAX_LINES", () => {
    let s = multiLine([["a"], ["b"], ["c"]]);
    s = reduce(s, { type: "move-cursor", dy: 2 }); // on line 2
    expect(reduce(s, { type: "move-widget", dy: 1 })).toBe(s);
  });

  it("is a no-op when no widget is selected", () => {
    const s = multiLine([[], ["a"]]); // cursor on empty line 0
    expect(reduce(s, { type: "move-widget", dx: 1 })).toBe(s);
    expect(reduce(s, { type: "move-widget", dy: 1 })).toBe(s);
  });
});

describe("reduce: picker overlay", () => {
  it("open/close toggles picker mode without touching the layout", () => {
    let s = makeState([{ type: "model" }]);
    s = reduce(s, { type: "open-picker", target: "insert" });
    expect(s.mode).toBe("picker");
    expect(s.pickerTarget).toBe("insert");
    expect(s.dirty).toBe(false);
    s = reduce(s, { type: "close-picker" });
    expect(s.mode).toBe("edit");
  });

  it("downgrades a replace-target picker to insert when nothing is selected", () => {
    const s = makeState([]); // empty line, widget = -1
    const picking = reduce(s, { type: "open-picker", target: "replace" });
    expect(picking.pickerTarget).toBe("insert");
  });

  it("apply-picker inserts at the cursor (insert target) and returns to edit", () => {
    let s = multiLine([["a", "c"]]); // cursor at widget 0
    s = reduce(s, { type: "open-picker", target: "insert" });
    s = reduce(s, { type: "apply-picker", widgetType: "b" });
    expect(typesOf(s)).toEqual([["a", "b", "c"]]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.mode).toBe("edit");
    expect(s.dirty).toBe(true);
  });

  it("apply-picker replaces the selected widget (replace target)", () => {
    let s = multiLine([["a", "b"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 }); // select "b"
    s = reduce(s, { type: "open-picker", target: "replace" });
    s = reduce(s, { type: "apply-picker", widgetType: "z" });
    expect(typesOf(s)).toEqual([["a", "z"]]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.mode).toBe("edit");
  });

  it("apply-picker with an empty type just closes the picker", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "open-picker", target: "insert" });
    s = reduce(s, { type: "apply-picker", widgetType: "" });
    expect(s.mode).toBe("edit");
    expect(typesOf(s)).toEqual([["a"]]);
  });
});

describe("reduce: options overlay", () => {
  it("opens only when a widget is selected", () => {
    expect(reduce(makeState([]), { type: "open-options" }).mode).toBe("edit");
    const s = reduce(makeState([{ type: "a" }]), { type: "open-options" });
    expect(s.mode).toBe("options");
  });

  it("set-option merges into the widget's options and marks dirty", () => {
    let s = reduce(makeState([{ type: "tokens-total" }]), { type: "open-options" });
    s = reduce(s, { type: "set-option", key: "reset", value: "block" });
    s = reduce(s, { type: "set-option", key: "format", value: "human" });
    expect(s.lines[0]?.widgets[0]?.options).toEqual({ reset: "block", format: "human" });
    expect(s.dirty).toBe(true);
    expect(s.mode).toBe("options");
  });

  it("set-option rejects empty and prototype-polluting keys", () => {
    const s = reduce(makeState([{ type: "a" }]), { type: "open-options" });
    expect(reduce(s, { type: "set-option", key: "  ", value: 1 })).toBe(s);
    expect(reduce(s, { type: "set-option", key: "__proto__", value: {} })).toBe(s);
  });

  it("close-options returns to edit mode", () => {
    let s = reduce(makeState([{ type: "a" }]), { type: "open-options" });
    s = reduce(s, { type: "close-options" });
    expect(s.mode).toBe("edit");
  });
});

describe("reduce: mark-dirty", () => {
  it("sets the dirty flag once", () => {
    const clean = makeState([{ type: "a" }]);
    const dirty = reduce(clean, { type: "mark-dirty" });
    expect(dirty.dirty).toBe(true);
    expect(reduce(dirty, { type: "mark-dirty" })).toBe(dirty);
  });
});
