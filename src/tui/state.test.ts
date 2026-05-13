import { describe, expect, it } from "vitest";

import type { LineConfig, WidgetConfig } from "../config/types.js";

import {
  MAX_LINES,
  currentWidget,
  initialState,
  isAddCell,
  reduce,
  widgetCountAt,
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
  it("always pads to exactly MAX_LINES rows", () => {
    expect(initialState([]).lines).toHaveLength(MAX_LINES);
    expect(initialState([{ widgets: [{ type: "a" }] }]).lines).toHaveLength(MAX_LINES);
    expect(typesOf(initialState([]))).toEqual([[], [], []]);
  });

  it("lands the cursor on the row's first widget when one exists", () => {
    const s = initialState([{ widgets: [{ type: "model" }, { type: "clock" }] }]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(s.dirty).toBe(false);
  });

  it("lands the cursor on the add-cell when the first row is empty", () => {
    const s = initialState([]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(isAddCell(s)).toBe(true);
    expect(currentWidget(s)).toBeUndefined();
  });

  it("trims input beyond MAX_LINES rather than dropping later rows entirely", () => {
    const s = initialState([
      { widgets: [{ type: "a" }] },
      { widgets: [{ type: "b" }] },
      { widgets: [{ type: "c" }] },
      { widgets: [{ type: "d" }] }, // dropped
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

describe("isAddCell / currentWidget", () => {
  it("isAddCell is true exactly when cursor.widget === widgets.length", () => {
    const s = makeState([{ type: "a" }]);
    expect(isAddCell(s)).toBe(false);
    const moved = reduce(s, { type: "move-cursor", dx: 1 });
    expect(moved.cursor.widget).toBe(1); // add-cell
    expect(isAddCell(moved)).toBe(true);
    expect(currentWidget(moved)).toBeUndefined();
  });
});

describe("reduce: move-cursor — the up/down fix", () => {
  it("up/down moves across all 3 rows (regression: arrows were no-ops on single-row configs)", () => {
    // Padded state has 3 rows; even a single-row input config gets all 3 slots.
    let s = makeState([{ type: "a" }]);
    expect(s.lines).toHaveLength(MAX_LINES);
    s = reduce(s, { type: "move-cursor", dy: 1 });
    expect(s.cursor.line).toBe(1);
    s = reduce(s, { type: "move-cursor", dy: 1 });
    expect(s.cursor.line).toBe(2);
    s = reduce(s, { type: "move-cursor", dy: -2 });
    expect(s.cursor.line).toBe(0);
  });

  it("dy clamps the column onto the add-cell when the destination row is shorter", () => {
    let s = multiLine([["a", "b", "c"], ["d"], []]);
    s = reduce(s, { type: "move-cursor", dx: 2 }); // line 0, widget 2
    s = reduce(s, { type: "move-cursor", dy: 1 }); // line 1, widget clamps to 1 (the add-cell)
    expect(s.cursor).toEqual({ line: 1, widget: 1 });
    expect(isAddCell(s)).toBe(true);
    s = reduce(s, { type: "move-cursor", dy: 1 }); // line 2 is empty — add-cell at col 0
    expect(s.cursor).toEqual({ line: 2, widget: 0 });
    expect(isAddCell(s)).toBe(true);
  });

  it("dx walks onto the add-cell at the end of the row but doesn't overshoot", () => {
    let s = multiLine([["a", "b"]]); // row 0 add-cell at col 2
    s = reduce(s, { type: "move-cursor", dx: 1 });
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    s = reduce(s, { type: "move-cursor", dx: 1 });
    expect(s.cursor).toEqual({ line: 0, widget: 2 }); // add-cell
    s = reduce(s, { type: "move-cursor", dx: 5 });
    expect(s.cursor).toEqual({ line: 0, widget: 2 }); // clamped
  });

  it("is a no-op past the last row and inert outside edit mode", () => {
    let s = multiLine([["a"]]);
    // Currently on line 0; jumping past line 2 clamps to line 2.
    const past = reduce(s, { type: "move-cursor", dy: 5 });
    expect(past.cursor.line).toBe(MAX_LINES - 1);
    // In picker mode, move-cursor is inert.
    const picking = reduce(s, { type: "open-picker", target: "insert" });
    expect(reduce(picking, { type: "move-cursor", dx: 1 })).toBe(picking);
  });
});

describe("reduce: move-widget", () => {
  it("shifts a widget within its row, cursor following", () => {
    let s = multiLine([["a", "b", "c"]]);
    s = reduce(s, { type: "move-widget", dx: 2 });
    expect(typesOf(s)[0]).toEqual(["b", "c", "a"]);
    expect(s.cursor).toEqual({ line: 0, widget: 2 });
    expect(s.dirty).toBe(true);
  });

  it("cannot move a widget onto the add-cell (column count - 1 is the cap)", () => {
    let s = multiLine([["a", "b"]]); // add-cell at col 2
    s = reduce(s, { type: "move-widget", dx: 5 });
    // "a" went to col 1 (the last real widget index) — not to col 2.
    expect(typesOf(s)[0]).toEqual(["b", "a"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
  });

  it("moves to the adjacent row, landing before that row's add-cell", () => {
    let s = multiLine([["a", "b"], ["c"]]);
    s = reduce(s, { type: "move-widget", dy: 1 }); // move "a" → end of line 1
    expect(typesOf(s).slice(0, 2)).toEqual([["b"], ["c", "a"]]);
    expect(s.cursor).toEqual({ line: 1, widget: 1 });
  });

  it("creates content in a previously-empty row (rows are pre-padded so the destination exists)", () => {
    let s = multiLine([["a"]]); // rows 1 and 2 are padded empties
    s = reduce(s, { type: "move-widget", dy: 1 });
    expect(typesOf(s).slice(0, 2)).toEqual([[], ["a"]]);
    expect(s.cursor).toEqual({ line: 1, widget: 0 });
  });

  it("refuses to exceed the grid", () => {
    let s = multiLine([[], [], ["a"]]); // cursor lands on line 0 add-cell — move down to "a"
    s = reduce(s, { type: "move-cursor", dy: 2 });
    expect(s.cursor).toEqual({ line: 2, widget: 0 });
    expect(reduce(s, { type: "move-widget", dy: 1 })).toBe(s);
  });

  it("is a no-op when the add-cell is selected (nothing to move)", () => {
    const s = makeState([]); // empty row 0 ⇒ cursor on add-cell
    expect(isAddCell(s)).toBe(true);
    expect(reduce(s, { type: "move-widget", dx: 1 })).toBe(s);
    expect(reduce(s, { type: "move-widget", dy: 1 })).toBe(s);
  });
});

describe("reduce: add (insert)", () => {
  it("from a widget cell, inserts after the cursor", () => {
    let s = makeState([{ type: "a" }, { type: "c" }]);
    s = reduce(s, { type: "add", widgetType: "b" });
    expect(typesOf(s)[0]).toEqual(["a", "b", "c"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
  });

  it("from the add-cell, appends at the end of the row", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "move-cursor", dx: 1 }); // onto add-cell
    expect(isAddCell(s)).toBe(true);
    s = reduce(s, { type: "add", widgetType: "b" });
    expect(typesOf(s)[0]).toEqual(["a", "b"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.dirty).toBe(true);
  });

  it("on an empty row, the add-cell is selected by default — insert just places the widget at col 0", () => {
    let s = makeState([]); // row 0 empty, cursor on add-cell
    s = reduce(s, { type: "add", widgetType: "model" });
    expect(typesOf(s)[0]).toEqual(["model"]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
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
    expect(typesOf(s)[0]).toEqual(["a", "c"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.dirty).toBe(true);
  });

  it("clamps cursor to last widget when removing the tail", () => {
    let s = makeState([{ type: "a" }, { type: "b" }]);
    s = reduce(s, { type: "move-cursor", dx: 1 });
    s = reduce(s, { type: "delete" });
    expect(s.cursor.widget).toBe(1); // the add-cell (widgets.length === 1, cursor min(1, 1) = 1)
    expect(isAddCell(s)).toBe(true);
  });

  it("when the row empties, the cursor lands on the (newly-bare) add-cell", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "delete" });
    expect(typesOf(s)[0]).toEqual([]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(isAddCell(s)).toBe(true);
  });

  it("is a no-op on the add-cell", () => {
    const s = makeState([]); // cursor on add-cell
    expect(reduce(s, { type: "delete" })).toBe(s);
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

  it("toggle / cycle are no-ops when the add-cell is selected", () => {
    const s = makeState([]); // add-cell
    expect(reduce(s, { type: "toggle-hidden" })).toBe(s);
    expect(reduce(s, { type: "cycle-merge" })).toBe(s);
  });

  it("mark-clean drops the dirty flag", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "toggle-hidden" });
    expect(s.dirty).toBe(true);
    s = reduce(s, { type: "mark-clean" });
    expect(s.dirty).toBe(false);
  });
});

describe("widgetCountAt", () => {
  it("returns the number of real widgets in the given row", () => {
    const s = multiLine([["a", "b"], [], ["c"]]);
    expect(widgetCountAt(s, 0)).toBe(2);
    expect(widgetCountAt(s, 1)).toBe(0);
    expect(widgetCountAt(s, 2)).toBe(1);
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

  it("downgrades a replace-target picker to insert when the add-cell is selected", () => {
    const s = makeState([]); // empty row, cursor on add-cell
    const picking = reduce(s, { type: "open-picker", target: "replace" });
    expect(picking.pickerTarget).toBe("insert");
  });

  it("apply-picker inserts at the cursor (insert target) and returns to edit", () => {
    let s = multiLine([["a", "c"]]); // cursor at widget 0
    s = reduce(s, { type: "open-picker", target: "insert" });
    s = reduce(s, { type: "apply-picker", widgetType: "b" });
    expect(typesOf(s)[0]).toEqual(["a", "b", "c"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.mode).toBe("edit");
    expect(s.dirty).toBe(true);
  });

  it("apply-picker from the add-cell appends", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 }); // onto add-cell
    s = reduce(s, { type: "open-picker", target: "insert" });
    s = reduce(s, { type: "apply-picker", widgetType: "b" });
    expect(typesOf(s)[0]).toEqual(["a", "b"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
  });

  it("apply-picker replaces the selected widget (replace target)", () => {
    let s = multiLine([["a", "b"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 }); // select "b"
    s = reduce(s, { type: "open-picker", target: "replace" });
    s = reduce(s, { type: "apply-picker", widgetType: "z" });
    expect(typesOf(s)[0]).toEqual(["a", "z"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.mode).toBe("edit");
  });

  it("apply-picker with an empty type just closes the picker", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "open-picker", target: "insert" });
    s = reduce(s, { type: "apply-picker", widgetType: "" });
    expect(s.mode).toBe("edit");
    expect(typesOf(s)[0]).toEqual(["a"]);
  });
});

describe("reduce: options overlay", () => {
  it("opens only when a widget is selected (the add-cell can't be configured)", () => {
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
