import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Key as KeyEvent } from "ink";

import type { LineConfig } from "../config/types.js";

import {
  handleEditKey,
  handlePickerGroupKey,
  handlePickerSearchKey,
  handlePickerVariantKey,
  handlePickerWidgetKey,
  sanitizeTypedInput,
  type EditHandlerDeps,
  type PickerHandlerDeps,
} from "./editor-input-handlers.js";
import { familiesWithWidgets } from "./picker.js";
import type { SaveTracker } from "./mount.js";
import { initialState, reduce, type EditorAction, type EditorState } from "./state.js";

const KEY_DEFAULTS: KeyEvent = Object.freeze({
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
});

const key = (overrides: Partial<KeyEvent> = {}): KeyEvent => ({ ...KEY_DEFAULTS, ...overrides });

const widgetEntries = [
  { type: "git-branch", name: "Git branch", description: "current branch", family: "git" },
  { type: "model", name: "Model", description: "active model id", family: "session" },
  { type: "tokens", name: "Tokens", description: "input + output tokens", family: "tokens" },
] as const;

const makeEdit = (lines: LineConfig[] = [{ widgets: [{ type: "model" }] }]): EditorState =>
  initialState(lines);

const enterPickerInsert = (state: EditorState): EditorState =>
  reduce(state, { type: "open-picker", intent: "add" });

const stepToPickerWidget = (state: EditorState): EditorState =>
  reduce(enterPickerInsert(state), { type: "pick-family", family: "git" });

const stepToPickerSearch = (state: EditorState): EditorState =>
  reduce(enterPickerInsert(state), { type: "open-search" });

const makePickerDeps = (
  state: EditorState,
  over: Partial<PickerHandlerDeps> = {},
): {
  deps: PickerHandlerDeps;
  dispatch: ReturnType<typeof vi.fn>;
  setStepQuery: ReturnType<typeof vi.fn>;
  setStepHighlight: ReturnType<typeof vi.fn>;
} => {
  const dispatch = vi.fn<(a: EditorAction) => void>();
  const setStepQuery = vi.fn();
  const setStepHighlight = vi.fn();
  return {
    dispatch,
    setStepQuery,
    setStepHighlight,
    deps: {
      state,
      dispatch,
      widgetEntries,
      usedTypes: new Set<string>(),
      stepQuery: "",
      stepHighlight: 0,
      setStepQuery,
      setStepHighlight,
      ...over,
    },
  };
};

describe("handlePickerGroupKey", () => {
  let state: EditorState;
  beforeEach(() => {
    state = enterPickerInsert(makeEdit());
  });

  it("dispatches picker-back on Escape", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerGroupKey("", key({ escape: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("Enter dispatches pick-family for the highlighted family", () => {
    const { deps, dispatch } = makePickerDeps(state, { stepHighlight: 0 });
    handlePickerGroupKey("", key({ return: true }), deps);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]?.[0];
    expect(action?.type).toBe("pick-family");
  });

  it("Left arrow also dispatches picker-back", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerGroupKey("", key({ leftArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("Right arrow advances like Enter (pick-family)", () => {
    const { deps, dispatch } = makePickerDeps(state, { stepHighlight: 0 });
    handlePickerGroupKey("", key({ rightArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]?.type).toBe("pick-family");
  });

  it("dispatches open-search on `/`", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerGroupKey("/", key(), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "open-search" });
  });

  it("ignores ordinary printable characters (no auto-filter in group view)", () => {
    const { deps, setStepQuery, dispatch } = makePickerDeps(state);
    handlePickerGroupKey("g", key(), deps);
    expect(setStepQuery).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("Up arrow on the first row wraps to the last group", () => {
    const last = familiesWithWidgets(widgetEntries, new Set()).length - 1;
    const { deps, setStepHighlight } = makePickerDeps(state);
    handlePickerGroupKey("", key({ upArrow: true }), deps);
    const next = setStepHighlight.mock.calls[0]?.[0] as (h: number) => number;
    expect(next(0)).toBe(last);
  });

  it("Down arrow on the last row wraps to the first group", () => {
    const last = familiesWithWidgets(widgetEntries, new Set()).length - 1;
    const { deps, setStepHighlight } = makePickerDeps(state);
    handlePickerGroupKey("", key({ downArrow: true }), deps);
    const next = setStepHighlight.mock.calls[0]?.[0] as (h: number) => number;
    expect(next(last)).toBe(0);
  });
});

describe("handlePickerWidgetKey", () => {
  let state: EditorState;
  beforeEach(() => {
    state = stepToPickerWidget(makeEdit());
  });

  it("dispatches picker-back on Escape", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerWidgetKey("", key({ escape: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("Enter commits the highlighted widget inside the active family", () => {
    const { deps, dispatch } = makePickerDeps(state, { stepHighlight: 0 });
    handlePickerWidgetKey("", key({ return: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({
      type: "pick-widget",
      widgetType: "git-branch",
    });
  });

  it("Left arrow also dispatches picker-back", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerWidgetKey("", key({ leftArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("Right arrow commits like Enter (pick-widget)", () => {
    const { deps, dispatch } = makePickerDeps(state, { stepHighlight: 0 });
    handlePickerWidgetKey("", key({ rightArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "pick-widget", widgetType: "git-branch" });
  });

  it("printable chars extend the query and reset the highlight", () => {
    const { deps, setStepQuery, setStepHighlight } = makePickerDeps(state);
    handlePickerWidgetKey("b", key(), deps);
    expect(setStepQuery).toHaveBeenCalledTimes(1);
    expect(setStepHighlight).toHaveBeenCalledWith(0);
  });

  it("does nothing when called in edit mode (defensive narrowing)", () => {
    const editState = makeEdit();
    const { deps, dispatch } = makePickerDeps(editState);
    handlePickerWidgetKey("x", key(), deps);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("a multi-character paste appends the whole sanitized string", () => {
    const { deps, setStepQuery, setStepHighlight } = makePickerDeps(state);
    handlePickerWidgetKey("git-br", key(), deps);
    const next = setStepQuery.mock.calls[0]?.[0] as (q: string) => string;
    expect(next("")).toBe("git-br");
    expect(setStepHighlight).toHaveBeenCalledWith(0);
  });
});

describe("handlePickerSearchKey", () => {
  let state: EditorState;
  beforeEach(() => {
    state = stepToPickerSearch(makeEdit());
  });

  it("dispatches picker-back on Escape (returning to the group view)", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerSearchKey("", key({ escape: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("extends the query on a printable character", () => {
    const { deps, setStepQuery, setStepHighlight, dispatch } = makePickerDeps(state);
    handlePickerSearchKey("g", key(), deps);
    expect(setStepQuery).toHaveBeenCalledTimes(1);
    expect(setStepHighlight).toHaveBeenCalledWith(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("Enter commits the highlighted widget from the filtered flat list", () => {
    const { deps, dispatch } = makePickerDeps(state, { stepQuery: "branch", stepHighlight: 0 });
    handlePickerSearchKey("", key({ return: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({
      type: "pick-widget",
      widgetType: "git-branch",
    });
  });

  it("Left arrow also dispatches picker-back", () => {
    const { deps, dispatch } = makePickerDeps(state);
    handlePickerSearchKey("", key({ leftArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("Right arrow commits like Enter (pick-widget)", () => {
    const { deps, dispatch } = makePickerDeps(state, { stepQuery: "branch", stepHighlight: 0 });
    handlePickerSearchKey("", key({ rightArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "pick-widget", widgetType: "git-branch" });
  });

  it("Backspace on an empty query is a no-op", () => {
    const { deps, dispatch, setStepQuery } = makePickerDeps(state, { stepQuery: "" });
    handlePickerSearchKey("", key({ backspace: true }), deps);
    expect(dispatch).not.toHaveBeenCalled();
    expect(setStepQuery).not.toHaveBeenCalled();
  });

  it("a multi-character paste appends the whole sanitized string", () => {
    const { deps, setStepQuery, setStepHighlight } = makePickerDeps(state);
    handlePickerSearchKey("git branch", key(), deps);
    const next = setStepQuery.mock.calls[0]?.[0] as (q: string) => string;
    expect(next("")).toBe("git branch");
    expect(setStepHighlight).toHaveBeenCalledWith(0);
  });
});

describe("handlePickerVariantKey", () => {
  it("returns silently when widgetType is missing on entry (defensive path)", () => {
    const { deps, dispatch } = makePickerDeps(enterPickerInsert(makeEdit()));
    handlePickerVariantKey("", key({ escape: true }), {
      ...deps,
      state: makeEdit(),
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches pick-variant on Enter when a row is highlighted", () => {
    /*
     * Drive a real picker-variant state by selecting a widget that always
     * has variants in the catalogue. `account-email` declares `full /
     * domain / localpart`, so this exercises the actual `picker-variant` dispatch
     * path. Asserting the mode hard ensures a future catalogue change
     * that removes those variants fails this test loudly instead of
     * letting it silently pass on an unreached branch.
     */
    let s: EditorState = makeEdit();
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    expect(s.mode).toBe("picker-variant");
    const { deps, dispatch } = makePickerDeps(s, { stepHighlight: 0 });
    handlePickerVariantKey("", key({ return: true }), deps);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]?.type).toBe("pick-variant");
  });

  it("Left arrow dispatches picker-back", () => {
    let s: EditorState = makeEdit();
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    const { deps, dispatch } = makePickerDeps(s);
    handlePickerVariantKey("", key({ leftArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "picker-back" });
  });

  it("Right arrow dispatches pick-variant like Enter", () => {
    let s: EditorState = makeEdit();
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    const { deps, dispatch } = makePickerDeps(s, { stepHighlight: 0 });
    handlePickerVariantKey("", key({ rightArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]?.type).toBe("pick-variant");
  });

  it("Up arrow on the first variant wraps to the last", () => {
    let s: EditorState = makeEdit();
    s = reduce(s, { type: "open-picker", intent: "add" });
    s = reduce(s, { type: "pick-family", family: "session" });
    s = reduce(s, { type: "pick-widget", widgetType: "account-email" });
    expect(s.mode).toBe("picker-variant");
    const { deps, setStepHighlight } = makePickerDeps(s);
    handlePickerVariantKey("", key({ upArrow: true }), deps);
    const next = setStepHighlight.mock.calls[0]?.[0] as (h: number) => number;
    // account-email declares full/domain/localpart → 1 synthetic + 3 = 4 rows.
    expect(next(0)).toBe(3);
  });
});

describe("sanitizeTypedInput", () => {
  it("passes printable text (incl. spaces and non-ASCII) through", () => {
    expect(sanitizeTypedInput("https://x.com/a b")).toBe("https://x.com/a b");
    expect(sanitizeTypedInput("héllo →")).toBe("héllo →");
  });

  it("strips control chars (newline, tab, CR, NUL, DEL) but keeps spaces", () => {
    expect(sanitizeTypedInput("a\nb\tc\rd")).toBe("abcd");
    expect(sanitizeTypedInput("x\u0000y\u007fz")).toBe("xyz");
    expect(sanitizeTypedInput("a b")).toBe("a b");
  });

  it("returns an empty string when nothing printable remains", () => {
    expect(sanitizeTypedInput("\n\r\t")).toBe("");
    expect(sanitizeTypedInput("")).toBe("");
  });
});

describe("handleEditKey", () => {
  const makeEditDeps = (
    state: EditorState = makeEdit(),
    over: Partial<EditHandlerDeps> = {},
  ): {
    deps: EditHandlerDeps;
    dispatch: ReturnType<typeof vi.fn>;
    exit: ReturnType<typeof vi.fn>;
    onSave: ReturnType<typeof vi.fn>;
    onSaved: ReturnType<typeof vi.fn>;
    setStatusMessage: ReturnType<typeof vi.fn>;
    saveTracker: SaveTracker;
  } => {
    const dispatch = vi.fn<(a: EditorAction) => void>();
    const exit = vi.fn();
    const onSave = vi.fn(async () => undefined);
    const onSaved = vi.fn();
    const setStatusMessage = vi.fn();
    const saveTracker: SaveTracker = { inFlight: null };
    return {
      dispatch,
      exit,
      onSave,
      onSaved,
      setStatusMessage,
      saveTracker,
      deps: {
        state,
        dispatch,
        widgetEntries,
        usedTypes: new Set<string>(),
        stepQuery: "",
        stepHighlight: 0,
        setStepQuery: vi.fn(),
        setStepHighlight: vi.fn(),
        exit,
        onSave,
        onSaved,
        saveTracker,
        setStatusMessage,
        ...over,
      },
    };
  };

  it("Escape signals saved=false and exits the app", () => {
    const { deps, onSaved, exit } = makeEditDeps();
    handleEditKey("", key({ escape: true }), deps);
    expect(onSaved).toHaveBeenCalledWith(false);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("q signals saved=false and exits the app", () => {
    const { deps, onSaved, exit } = makeEditDeps();
    handleEditKey("q", key(), deps);
    expect(onSaved).toHaveBeenCalledWith(false);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("s triggers onSave when no save is in flight", () => {
    const { deps, onSave } = makeEditDeps();
    handleEditKey("s", key(), deps);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("Ctrl-s also triggers onSave", () => {
    const { deps, onSave } = makeEditDeps();
    handleEditKey("s", key({ ctrl: true }), deps);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("s is suppressed while a save is already in flight", () => {
    const tracker: SaveTracker = { inFlight: Promise.resolve() };
    const { deps, onSave } = makeEditDeps(undefined, { saveTracker: tracker });
    handleEditKey("s", key(), deps);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ArrowRight dispatches move-cursor; Shift+ArrowRight dispatches move-widget", () => {
    const { deps, dispatch } = makeEditDeps();
    handleEditKey("", key({ rightArrow: true }), deps);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "move-cursor", dx: 1 });
    handleEditKey("", key({ rightArrow: true, shift: true }), deps);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "move-widget", dx: 1 });
  });

  it("Right arrow on the +add cell opens the picker (add intent)", () => {
    const onAddCell = reduce(makeEdit(), { type: "move-cursor", dx: 1 });
    const { deps, dispatch } = makeEditDeps(onAddCell);
    handleEditKey("", key({ rightArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "open-picker", intent: "add" });
  });

  it("Shift+Right on the +add cell still moves the widget, not the picker", () => {
    const onAddCell = reduce(makeEdit(), { type: "move-cursor", dx: 1 });
    const { deps, dispatch } = makeEditDeps(onAddCell);
    handleEditKey("", key({ rightArrow: true, shift: true }), deps);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "move-widget", dx: 1 });
    expect(dispatch).not.toHaveBeenCalledWith({ type: "open-picker", intent: "add" });
  });

  it("Left arrow in edit mode still moves the cursor (back stays picker-only)", () => {
    const { deps, dispatch } = makeEditDeps();
    handleEditKey("", key({ leftArrow: true }), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "move-cursor", dx: -1 });
  });

  it("a opens the picker (add intent)", () => {
    const { deps, dispatch } = makeEditDeps();
    handleEditKey("a", key(), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "open-picker", intent: "add" });
  });

  it("r opens the picker (replace intent)", () => {
    const { deps, dispatch } = makeEditDeps();
    handleEditKey("r", key(), deps);
    expect(dispatch).toHaveBeenCalledWith({ type: "open-picker", intent: "replace" });
  });

  it("d / x / Delete / Backspace dispatch delete", () => {
    for (const k of [
      { d: true },
      { x: true },
      { keyOpts: { delete: true } },
      { keyOpts: { backspace: true } },
    ]) {
      const { deps, dispatch } = makeEditDeps();
      handleEditKey(
        "d" in k && k.d ? "d" : "x" in k && k.x ? "x" : "",
        "keyOpts" in k ? key(k.keyOpts) : key(),
        deps,
      );
      expect(dispatch).toHaveBeenCalledWith({ type: "delete" });
    }
  });
});
