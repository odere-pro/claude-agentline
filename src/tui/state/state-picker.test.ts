/**
 * Direct unit coverage for the picker reducer transitions in
 * `state-picker.ts`. The barrel `state.test.ts` reaches them through
 * the dispatcher, but the picker file is 230 lines and several
 * branches (variant-less commit, replace vs insert, `pickerBack`
 * routing search → group) are easier to assert against the helpers
 * directly than through `reduce` actions.
 */
import { describe, expect, it } from "vitest";

import type { LineConfig } from "../../data/config/types.js";

import { initialState, type EditorEditState, type EditorPickerState, type EditorState } from "./state.js";

import {
  openPicker,
  openSearch,
  pickFamily,
  pickVariant,
  pickWidget,
  pickerBack,
} from "./state-picker.js";

function editStateWith(lines: LineConfig[]): EditorEditState {
  return initialState(lines);
}

function asPicker(state: EditorState): EditorPickerState {
  if (state.mode === "edit") {
    throw new Error(`asPicker: expected a picker state, got mode="edit"`);
  }
  return state;
}

describe("openPicker", () => {
  it("transitions edit → picker-group with an insert target on the add-cell", () => {
    const base = editStateWith([{ widgets: [] }]);
    const next = asPicker(openPicker(base, "add"));
    expect(next.mode).toBe("picker-group");
    expect(next.pickerTarget.kind).toBe("insert");
    expect(next.pickerTarget.index).toBe(0);
    expect(next.pickerDraft).toEqual({});
  });

  it("transitions edit → picker-group with a replace target when the cursor sits on a widget", () => {
    const base = editStateWith([{ widgets: [{ type: "model" }, { type: "version" }] }]);
    const cursored: EditorEditState = { ...base, cursor: { line: 0, widget: 1 } };
    const next = asPicker(openPicker(cursored, "replace"));
    expect(next.pickerTarget).toEqual({ kind: "replace", line: 0, index: 1 });
  });

  it("degrades 'replace' to 'insert' when the cursor is on the add-cell (no widget under it)", () => {
    const base = editStateWith([{ widgets: [{ type: "model" }] }]);
    // cursor.widget === 1 is the add-cell when only one widget exists.
    const cursored: EditorEditState = { ...base, cursor: { line: 0, widget: 1 } };
    const next = asPicker(openPicker(cursored, "replace"));
    expect(next.pickerTarget.kind).toBe("insert");
    expect(next.pickerTarget.index).toBe(1);
  });

  it("is a no-op when called from a picker mode (reducer enforces edit-only entry)", () => {
    const base = editStateWith([{ widgets: [] }]);
    const picker = openPicker(base, "add");
    expect(openPicker(picker, "add")).toBe(picker);
  });
});

describe("openSearch", () => {
  it("flips picker-group → picker-search and clears any draft family", () => {
    const base = editStateWith([{ widgets: [] }]);
    const group = asPicker(openPicker(base, "add"));
    const withFamily: EditorPickerState = {
      ...group,
      pickerDraft: { ...group.pickerDraft, family: "git" },
    };
    const next = asPicker(openSearch(withFamily));
    expect(next.mode).toBe("picker-search");
    expect(next.pickerDraft.family).toBeUndefined();
  });

  it("ignores openSearch from anywhere other than picker-group", () => {
    const base = editStateWith([{ widgets: [] }]);
    expect(openSearch(base)).toBe(base);
    const search = openSearch(openPicker(base, "add"));
    // calling openSearch again from picker-search is inert
    expect(openSearch(search)).toBe(search);
  });
});

describe("pickFamily / pickWidget commit paths", () => {
  it("pickFamily moves picker-group → picker-widget and records the family in the draft", () => {
    const base = editStateWith([{ widgets: [] }]);
    const group = openPicker(base, "add");
    const next = asPicker(pickFamily(group, "git"));
    expect(next.mode).toBe("picker-widget");
    expect(next.pickerDraft.family).toBe("git");
  });

  it("pickWidget on a variant-less type commits immediately back to edit", () => {
    const base = editStateWith([{ widgets: [] }]);
    const family = pickFamily(openPicker(base, "add"), "session");
    // `version` is a real variant-less session widget.
    const committed = pickWidget(family, "version");
    expect(committed.mode).toBe("edit");
    expect(committed.lines[0]?.widgets.map((w: { type: string }) => w.type)).toEqual(["version"]);
  });

  it("an empty widgetType passed to pickWidget retreats to edit (backToEdit)", () => {
    const base = editStateWith([{ widgets: [] }]);
    const family = pickFamily(openPicker(base, "add"), "git");
    expect(pickWidget(family, "").mode).toBe("edit");
  });
});

describe("pickVariant", () => {
  // No shipped widget declares variants today (the catalog field exists for
  // forward-compat, see widgets/catalog/types.ts). Drive the picker-variant
  // state by hand so the reducer branches stay regression-pinned even
  // before a real variant lands.
  function variantState(): EditorPickerState {
    const base = editStateWith([{ widgets: [] }]);
    const family = asPicker(pickFamily(openPicker(base, "add"), "git"));
    return {
      ...family,
      mode: "picker-variant",
      pickerDraft: { ...family.pickerDraft, widgetType: "git-branch" },
    };
  }

  it("`null` (no variant) commits the bare widget with no options", () => {
    const committed = pickVariant(variantState(), null);
    expect(committed.mode).toBe("edit");
    const placed = committed.lines[0]?.widgets[0];
    expect(placed?.type).toBe("git-branch");
    expect(placed?.options).toBeUndefined();
  });

  it("a variantId the catalogue does not recognise commits with no options (degrade gracefully)", () => {
    const committed = pickVariant(variantState(), "not-a-real-variant");
    expect(committed.mode).toBe("edit");
    const placed = committed.lines[0]?.widgets[0];
    expect(placed?.type).toBe("git-branch");
    expect(placed?.options).toBeUndefined();
  });

  it("ignores pickVariant when not currently in picker-variant", () => {
    const base = editStateWith([{ widgets: [] }]);
    expect(pickVariant(base, null)).toBe(base);
  });
});

describe("pickerBack", () => {
  it("picker-variant routes back to picker-widget when the draft carries a family", () => {
    const base = editStateWith([{ widgets: [] }]);
    const family = asPicker(pickFamily(openPicker(base, "add"), "git"));
    const variant: EditorPickerState = {
      ...family,
      mode: "picker-variant",
      pickerDraft: { ...family.pickerDraft, widgetType: "git-branch" },
    };
    const back = asPicker(pickerBack(variant));
    expect(back.mode).toBe("picker-widget");
    expect(back.pickerDraft.widgetType).toBeUndefined();
    expect(back.pickerDraft.family).toBe("git");
  });

  it("picker-variant routes back to picker-search when the draft has no family (came via flat search)", () => {
    const base = editStateWith([{ widgets: [] }]);
    const search = asPicker(openSearch(openPicker(base, "add")));
    const variant: EditorPickerState = {
      ...search,
      mode: "picker-variant",
      pickerDraft: { ...search.pickerDraft, widgetType: "git-branch" },
    };
    const back = asPicker(pickerBack(variant));
    expect(back.mode).toBe("picker-search");
  });

  it("picker-widget → picker-group keeps the previously-picked family in the draft", () => {
    const base = editStateWith([{ widgets: [] }]);
    const family = pickFamily(openPicker(base, "add"), "git");
    const back = asPicker(pickerBack(family));
    expect(back.mode).toBe("picker-group");
    expect(back.pickerDraft.family).toBe("git");
  });

  it("picker-search → picker-group returns to the group browser", () => {
    const base = editStateWith([{ widgets: [] }]);
    const search = openSearch(openPicker(base, "add"));
    const back = pickerBack(search);
    expect(back.mode).toBe("picker-group");
  });

  it("picker-group → edit (Esc out of the picker)", () => {
    const base = editStateWith([{ widgets: [] }]);
    const group = openPicker(base, "add");
    const back = pickerBack(group);
    expect(back.mode).toBe("edit");
    // Picker-only fields must be gone — the discriminated union enforces
    // this at the type level but we assert it explicitly here too.
    expect((back as unknown as Record<string, unknown>).pickerTarget).toBeUndefined();
    expect((back as unknown as Record<string, unknown>).pickerDraft).toBeUndefined();
  });
});

describe("commit branches (replace vs insert)", () => {
  it("replace overwrites the cursor's widget and resets options", () => {
    const base = editStateWith([
      { widgets: [{ type: "model", options: { label: "M:" } }, { type: "version" }] },
    ]);
    const cursored: EditorEditState = { ...base, cursor: { line: 0, widget: 0 } };
    const variant = pickWidget(
      pickFamily(openPicker(cursored, "replace"), "session"),
      "vim-mode",
    );
    expect(variant.mode).toBe("edit");
    const placed = variant.lines[0]?.widgets[0];
    expect(placed?.type).toBe("vim-mode");
    expect(placed?.options).toBeUndefined();
    expect(variant.lines[0]?.widgets[1]?.type).toBe("version");
  });

  it("insert splices a widget after the cursor when called as 'add' on a populated row", () => {
    const base = editStateWith([{ widgets: [{ type: "model" }, { type: "version" }] }]);
    const cursored: EditorEditState = { ...base, cursor: { line: 0, widget: 0 } };
    const placed = pickWidget(
      pickFamily(openPicker(cursored, "add"), "session"),
      "vim-mode",
    );
    expect(placed.lines[0]?.widgets.map((w: { type: string }) => w.type)).toEqual([
      "model",
      "vim-mode",
      "version",
    ]);
  });
});
