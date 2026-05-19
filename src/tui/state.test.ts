import { describe, expect, it } from "vitest";

import type { LineConfig, WidgetConfig } from "../config/types.js";

import {
  MAX_LINES,
  currentWidget,
  initialState,
  isAddCell,
  isPickerMode,
  reduce,
  widgetCountAt,
  type EditorPickerState,
  type EditorState,
} from "./state.js";

/**
 * Narrow an `EditorState` to its picker variant for assertions on
 * `pickerTarget` / `pickerDraft`. Throws when the test reaches an
 * unexpected mode so a regression in the reducer fails loudly instead
 * of silently asserting against `undefined` fields.
 */
function asPicker(state: EditorState): EditorPickerState {
  if (state.mode === "edit") {
    throw new Error(`asPicker: expected a picker state, got mode="edit"`);
  }
  return state;
}

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
    const s = initialState([{ widgets: [{ type: "model" }, { type: "version" }] }]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(s.dirty).toBe(false);
  });

  it("lands the cursor on the add-cell when the first row is empty", () => {
    const s = initialState([]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(isAddCell(s)).toBe(true);
    expect(currentWidget(s)).toBeUndefined();
  });

  it("starts in edit mode (no picker fields)", () => {
    /*
     * The discriminated union in `EditorState` excludes `pickerDraft` /
     * `pickerTarget` from the edit branch — the assertion on `mode`
     * alone covers the contract.
     */
    const s = makeState([{ type: "a" }]);
    expect(s.mode).toBe("edit");
  });
});

describe("isAddCell / currentWidget / isPickerMode", () => {
  it("isAddCell is true exactly when cursor.widget === widgets.length", () => {
    const s = makeState([{ type: "a" }]);
    expect(isAddCell(s)).toBe(false);
    const moved = reduce(s, { type: "move-cursor", dx: 1 });
    expect(moved.cursor.widget).toBe(1);
    expect(isAddCell(moved)).toBe(true);
    expect(currentWidget(moved)).toBeUndefined();
  });

  it("isPickerMode covers every picker-* step", () => {
    expect(isPickerMode("picker-group")).toBe(true);
    expect(isPickerMode("picker-widget")).toBe(true);
    expect(isPickerMode("picker-search")).toBe(true);
    expect(isPickerMode("picker-variant")).toBe(true);
    expect(isPickerMode("edit")).toBe(false);
  });
});

describe("reduce: move-cursor — the up/down fix", () => {
  it("up/down moves across all 3 padded rows", () => {
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
    s = reduce(s, { type: "move-cursor", dx: 2 });
    s = reduce(s, { type: "move-cursor", dy: 1 });
    expect(s.cursor).toEqual({ line: 1, widget: 1 });
    expect(isAddCell(s)).toBe(true);
    s = reduce(s, { type: "move-cursor", dy: 1 });
    expect(s.cursor).toEqual({ line: 2, widget: 0 });
    expect(isAddCell(s)).toBe(true);
  });

  it("dx walks onto the add-cell at the end of the row but doesn't overshoot", () => {
    let s = multiLine([["a", "b"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 });
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    s = reduce(s, { type: "move-cursor", dx: 1 });
    expect(s.cursor).toEqual({ line: 0, widget: 2 });
    s = reduce(s, { type: "move-cursor", dx: 5 });
    expect(s.cursor).toEqual({ line: 0, widget: 2 });
  });

  it("is inert outside edit mode", () => {
    const s = multiLine([["a"]]);
    const picking = reduce(s, { type: "open-picker", intent: "add" });
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

  it("cannot push a widget onto the add-cell", () => {
    let s = multiLine([["a", "b"]]);
    s = reduce(s, { type: "move-widget", dx: 5 });
    expect(typesOf(s)[0]).toEqual(["b", "a"]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
  });

  it("moves to the adjacent row, landing before that row's add-cell", () => {
    let s = multiLine([["a", "b"], ["c"]]);
    s = reduce(s, { type: "move-widget", dy: 1 });
    expect(typesOf(s).slice(0, 2)).toEqual([["b"], ["c", "a"]]);
    expect(s.cursor).toEqual({ line: 1, widget: 1 });
  });

  it("refuses to exceed the grid", () => {
    let s = multiLine([[], [], ["a"]]);
    s = reduce(s, { type: "move-cursor", dy: 2 });
    expect(s.cursor).toEqual({ line: 2, widget: 0 });
    expect(reduce(s, { type: "move-widget", dy: 1 })).toBe(s);
  });

  it("is a no-op on the add-cell", () => {
    const s = makeState([]);
    expect(isAddCell(s)).toBe(true);
    expect(reduce(s, { type: "move-widget", dx: 1 })).toBe(s);
    expect(reduce(s, { type: "move-widget", dy: 1 })).toBe(s);
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

  it("clamps cursor onto the add-cell when removing the tail", () => {
    let s = makeState([{ type: "a" }, { type: "b" }]);
    s = reduce(s, { type: "move-cursor", dx: 1 });
    s = reduce(s, { type: "delete" });
    expect(s.cursor.widget).toBe(1);
    expect(isAddCell(s)).toBe(true);
  });

  it("when the row empties, lands on the (newly-bare) add-cell", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "delete" });
    expect(typesOf(s)[0]).toEqual([]);
    expect(s.cursor).toEqual({ line: 0, widget: 0 });
    expect(isAddCell(s)).toBe(true);
  });

  it("is a no-op on the add-cell", () => {
    const s = makeState([]);
    expect(reduce(s, { type: "delete" })).toBe(s);
  });
});

describe("reduce: dirty bookkeeping", () => {
  it("mark-clean drops the dirty flag after a structural change", () => {
    let s = makeState([{ type: "a" }, { type: "b" }]);
    s = reduce(s, { type: "delete" });
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

describe("picker drill-down — open-picker (add intent)", () => {
  it("opens picker-group with an insert target *after* the cursor on a real widget", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    expect(s.mode).toBe("picker-group");
    expect(asPicker(s).pickerTarget).toEqual({ kind: "insert", line: 0, index: 1 });
    expect(asPicker(s).pickerDraft).toEqual({});
  });

  it("opens picker-group from the add-cell with index pointing at the row's end", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 });
    s = reduce(s, { type: "open-picker", intent: "add" });
    expect(asPicker(s).pickerTarget).toEqual({ kind: "insert", line: 0, index: 1 });
  });
});

describe("picker drill-down — open-picker (replace intent)", () => {
  it("opens picker-group with a replace target on a real widget", () => {
    let s = multiLine([["a", "b"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 });
    s = reduce(s, { type: "open-picker", intent: "replace" });
    expect(s.mode).toBe("picker-group");
    expect(asPicker(s).pickerTarget).toEqual({ kind: "replace", line: 0, index: 1 });
  });

  it("downgrades replace → insert when the add-cell is selected (nothing to replace)", () => {
    let s = makeState([]);
    s = reduce(s, { type: "open-picker", intent: "replace" });
    expect(asPicker(s).pickerTarget.kind).toBe("insert");
  });
});

describe("picker drill-down — pick-family → pick-widget → pick-variant", () => {
  it("drilling through a variant-bearing widget commits with the variant's options patch", () => {
    let s = multiLine([["model"]]);
    s = reduce(s, { type: "move-cursor", dx: 1 }); // onto add-cell
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    expect(s.mode).toBe("picker-widget");
    expect(asPicker(s).pickerDraft.family).toBe("session");
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    expect(s.mode).toBe("picker-variant");
    expect(asPicker(s).pickerDraft.widgetType).toBe("account-email");
    s = reduce(s, { type: "pick-variant", variantId: "domain" });
    expect(s.mode).toBe("edit");
    expect(s.lines[0]?.widgets).toEqual([
      { type: "model" },
      { type: "account-email", options: { mask: "domain" } },
    ]);
    expect(s.cursor).toEqual({ line: 0, widget: 1 });
    expect(s.dirty).toBe(true);
  });

  it("drilling through a no-variant widget commits immediately at pick-widget", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "git" });
    s = reduce(s, { type: "pick-widget", widgetType: "git-branch" });
    expect(s.mode).toBe("edit");
    expect(s.lines[0]?.widgets[1]).toEqual({ type: "git-branch" });
  });

  it("pick-variant with null commits without applying any options patch", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    s = reduce(s, { type: "pick-variant", variantId: null });
    expect(s.lines[0]?.widgets[1]).toEqual({ type: "account-email" });
  });
});

describe("picker drill-down — flat-search path (open-search)", () => {
  it("open-search switches the group view into picker-search", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    expect(s.mode).toBe("picker-group");
    s = reduce(s, { type: "open-search" });
    expect(s.mode).toBe("picker-search");
    expect(asPicker(s).pickerDraft.family).toBeUndefined();
  });

  it("pick-widget from picker-search commits without a family", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "open-search" });
    s = reduce(s, { type: "pick-widget", widgetType: "git-branch" });
    expect(s.mode).toBe("edit");
    expect(s.lines[0]?.widgets[1]).toEqual({ type: "git-branch" });
  });

  it("pick-widget from picker-search routes through picker-variant for variant-bearing widgets", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "open-search" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    expect(s.mode).toBe("picker-variant");
    expect(asPicker(s).pickerDraft.family).toBeUndefined();
    expect(asPicker(s).pickerDraft.widgetType).toBe("account-email");
  });

  it("picker-back from picker-search returns to picker-group", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "open-search" });
    s = reduce(s, { type: "picker-back" });
    expect(s.mode).toBe("picker-group");
  });

  it("picker-back from picker-variant returns to picker-search when no family was chosen", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "open-search" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    expect(s.mode).toBe("picker-variant");
    s = reduce(s, { type: "picker-back" });
    expect(s.mode).toBe("picker-search");
    expect(asPicker(s).pickerDraft.widgetType).toBeUndefined();
  });

  it("open-search is inert outside picker-group (e.g. from picker-widget)", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "git" });
    expect(s.mode).toBe("picker-widget");
    const after = reduce(s, { type: "open-search" });
    expect(after).toBe(s);
  });
});

describe("picker drill-down — replace target", () => {
  it("replace swaps the widget type and drops prior colour/style overrides", () => {
    let s: EditorState = initialState([
      { widgets: [{ type: "model", fg: "#ff00ff", bold: true }] },
    ]);
    s = reduce(s, { type: "open-picker", intent: "replace" });
    s = reduce(s, { type: "pick-family", family: "git" });
    s = reduce(s, { type: "pick-widget", widgetType: "git-branch" });
    expect(s.lines[0]?.widgets[0]).toEqual({ type: "git-branch" });
  });
});

describe("picker drill-down — picker-back and close-picker", () => {
  it("picker-back from picker-variant returns to picker-widget when a family was chosen", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    expect(s.mode).toBe("picker-variant");
    s = reduce(s, { type: "picker-back" });
    expect(s.mode).toBe("picker-widget");
    expect(asPicker(s).pickerDraft.widgetType).toBeUndefined();
    s = reduce(s, { type: "picker-back" });
    expect(s.mode).toBe("picker-group");
    /*
     * `pickerDraft.family` is intentionally preserved across
     * picker-widget → picker-group so the picker-group step can restore
     * the user's previous highlight on Esc. The next forward action
     * (`pick-family` from a fresh selection, or `close-picker`) replaces
     * or clears it.
     */
    expect(asPicker(s).pickerDraft.family).toBe("session");
    s = reduce(s, { type: "picker-back" });
    expect(s.mode).toBe("edit");
  });

  it("close-picker from any picker-* mode returns to edit", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    s = reduce(s, { type: "close-picker" });
    /*
     * The discriminated union in `EditorState` excludes `pickerDraft` /
     * `pickerTarget` from the edit branch — asserting on `mode` covers
     * the contract that the picker fields are gone after close.
     */
    expect(s.mode).toBe("edit");
  });
});

describe("picker — option sanitisation", () => {
  it("strips prototype-polluting keys from a variant's options patch", () => {
    let s = multiLine([["a"]]);
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    /*
     * Inject a malicious variantId — never matches a real variant, so commit
     * falls back to "default options" path. Defence-in-depth: sanitise.
     */
    s = reduce(s, { type: "pick-variant", variantId: "__proto__" });
    expect(s.lines[0]?.widgets[1]?.options).toBeUndefined();
    expect(s.mode).toBe("edit");
  });

  it("set-option still rejects empty and prototype-polluting keys", () => {
    const s = makeState([{ type: "a" }]);
    expect(reduce(s, { type: "set-option", key: "  ", value: 1 })).toBe(s);
    expect(reduce(s, { type: "set-option", key: "__proto__", value: {} })).toBe(s);
  });

  it("set-option merges into the widget's options and marks dirty", () => {
    let s = makeState([{ type: "tokens" }]);
    s = reduce(s, { type: "set-option", key: "reset", value: "block" });
    s = reduce(s, { type: "set-option", key: "format", value: "human" });
    expect(s.lines[0]?.widgets[0]?.options).toEqual({ reset: "block", format: "human" });
    expect(s.dirty).toBe(true);
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

describe("memento — lastSaved snapshot + revert", () => {
  it("initialState captures the loaded lines as the snapshot", () => {
    const s = makeState([{ type: "model" }]);
    expect(s.lastSaved.lines).toEqual(s.lines);
    expect(s.dirty).toBe(false);
  });

  it("mark-clean refreshes the snapshot to the current lines", () => {
    let s = makeState([{ type: "a" }]);
    s = reduce(s, { type: "set-option", key: "k", value: "v" });
    expect(s.dirty).toBe(true);
    s = reduce(s, { type: "mark-clean" });
    expect(s.dirty).toBe(false);
    expect(s.lastSaved.lines).toEqual(s.lines);
  });

  it("revert restores lines from the snapshot and clears dirty", () => {
    let s = makeState([{ type: "a" }]);
    const original = s.lines;
    s = reduce(s, { type: "set-option", key: "k", value: "v" });
    expect(s.dirty).toBe(true);
    s = reduce(s, { type: "revert" });
    expect(s.dirty).toBe(false);
    expect(s.lines).toBe(original);
  });

  it("revert is a no-op when the editor is already clean", () => {
    const s = makeState([{ type: "a" }]);
    expect(reduce(s, { type: "revert" })).toBe(s);
  });

  it("revert clamps the cursor back into the snapshot's bounds", () => {
    let s = makeState([{ type: "a" }, { type: "b" }, { type: "c" }]);
    s = reduce(s, { type: "move-cursor", dx: 2 });
    expect(s.cursor.widget).toBe(2);
    s = reduce(s, { type: "delete" });
    s = reduce(s, { type: "delete" });
    expect(s.dirty).toBe(true);
    s = reduce(s, { type: "revert" });
    expect(s.lines[0]?.widgets).toHaveLength(3);
    expect(s.cursor.widget).toBeLessThanOrEqual(s.lines[0]!.widgets.length);
  });
});
