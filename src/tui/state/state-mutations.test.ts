import { describe, expect, it } from "vitest";

import type { LineConfig } from "../../data/config/types.js";

import type { EditorEditState } from "./state-core.js";
import { EMPTY_HISTORY } from "./state-core.js";
import { deleteWidget, moveCursor, moveWidget, setOption } from "./state-mutations.js";

function editState(lines: LineConfig[], cursor = { line: 0, widget: 0 }): EditorEditState {
  return {
    mode: "edit",
    lines,
    cursor,
    dirty: false,
    lastSaved: { lines: structuredClone(lines) },
    history: EMPTY_HISTORY,
  };
}

describe("moveCursor", () => {
  it("returns the state unchanged when the cursor cannot move", () => {
    const state = editState([{ widgets: [{ type: "a" }] }], { line: 0, widget: 0 });
    expect(moveCursor(state, -1, 0)).toBe(state);
  });

  it("clamps the column to the row's add-cell (widgets.length)", () => {
    const state = editState([{ widgets: [{ type: "a" }, { type: "b" }] }], { line: 0, widget: 1 });
    const next = moveCursor(state, 999, 0);
    expect(next.cursor).toEqual({ line: 0, widget: 2 });
  });

  it("clamps the row to the available range when moving down past the end", () => {
    const state = editState([{ widgets: [{ type: "a" }] }, { widgets: [{ type: "b" }] }], {
      line: 0,
      widget: 0,
    });
    const next = moveCursor(state, 0, 99);
    expect(next.cursor.line).toBe(1);
  });
});

describe("moveWidget", () => {
  it("does nothing when the cursor is on the add-cell", () => {
    const state = editState([{ widgets: [{ type: "a" }] }], { line: 0, widget: 1 });
    expect(moveWidget(state, 1, 0)).toBe(state);
  });

  it("shifts a widget rightward within its row, advancing the cursor with it", () => {
    const state = editState([{ widgets: [{ type: "a" }, { type: "b" }, { type: "c" }] }], {
      line: 0,
      widget: 0,
    });
    const next = moveWidget(state, 1, 0);
    expect(next.lines[0]?.widgets.map((w) => w.type)).toEqual(["b", "a", "c"]);
    expect(next.cursor).toEqual({ line: 0, widget: 1 });
    expect(next.dirty).toBe(true);
  });

  it("moves a widget down to the adjacent row's tail", () => {
    const state = editState(
      [{ widgets: [{ type: "a" }, { type: "b" }] }, { widgets: [{ type: "c" }] }],
      { line: 0, widget: 0 },
    );
    const next = moveWidget(state, 0, 1);
    expect(next.lines[0]?.widgets.map((w) => w.type)).toEqual(["b"]);
    expect(next.lines[1]?.widgets.map((w) => w.type)).toEqual(["c", "a"]);
    expect(next.cursor).toEqual({ line: 1, widget: 1 });
  });

  it("refuses to move out of the grid (no row above)", () => {
    const state = editState([{ widgets: [{ type: "a" }] }, { widgets: [] }], {
      line: 0,
      widget: 0,
    });
    expect(moveWidget(state, 0, -1)).toBe(state);
  });
});

describe("deleteWidget", () => {
  it("removes the widget at the cursor and keeps the cursor within bounds", () => {
    const state = editState([{ widgets: [{ type: "a" }, { type: "b" }, { type: "c" }] }], {
      line: 0,
      widget: 1,
    });
    const next = deleteWidget(state);
    expect(next.lines[0]?.widgets.map((w) => w.type)).toEqual(["a", "c"]);
    expect(next.cursor).toEqual({ line: 0, widget: 1 });
    expect(next.dirty).toBe(true);
  });

  it("does nothing when the cursor is on the add-cell", () => {
    const state = editState([{ widgets: [{ type: "a" }] }], { line: 0, widget: 1 });
    expect(deleteWidget(state)).toBe(state);
  });

  it("clamps the cursor to the trailing add-cell after removing the last widget", () => {
    const state = editState([{ widgets: [{ type: "a" }] }], { line: 0, widget: 0 });
    const next = deleteWidget(state);
    expect(next.lines[0]?.widgets).toEqual([]);
    expect(next.cursor).toEqual({ line: 0, widget: 0 });
  });
});

describe("setOption", () => {
  it("merges the new option into the current widget's options", () => {
    const state = editState([{ widgets: [{ type: "a", options: { x: 1 } }] }]);
    const next = setOption(state, "y", 2);
    expect(next.lines[0]?.widgets[0]?.options).toEqual({ x: 1, y: 2 });
    expect(next.dirty).toBe(true);
  });

  it("refuses an empty or reserved key", () => {
    const state = editState([{ widgets: [{ type: "a" }] }]);
    expect(setOption(state, "", 1)).toBe(state);
    expect(setOption(state, " ", 1)).toBe(state);
    expect(setOption(state, "__proto__", 1)).toBe(state);
    expect(setOption(state, "constructor", 1)).toBe(state);
    expect(setOption(state, "prototype", 1)).toBe(state);
  });

  it("does nothing when the cursor is on the add-cell", () => {
    const state = editState([{ widgets: [{ type: "a" }] }], { line: 0, widget: 1 });
    expect(setOption(state, "x", 1)).toBe(state);
  });
});
