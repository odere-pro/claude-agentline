/**
 * Per-mode keypress handlers for the TUI editor.
 *
 * Each `handle*Key(input, key, deps)` is a plain function lifted out of
 * `use-editor-input.ts` (formerly four `useCallback` closures over half
 * the editor state). The hook now builds one `deps` bag and forwards
 * `useInput` to the right handler; every side effect flows through a
 * callback in `deps`, so the handlers are trivially testable without
 * mounting Ink.
 *
 * Smell-report 2026-05-15 H-code-1 follow-up: the `useInput` body was
 * thinned in PR #109; this module finishes that lift by moving the
 * handler bodies (62 / 47 / 34 / 66 LOC) out of the hook.
 */

import type { Key as KeyEvent } from "ink";
import type { Dispatch } from "react";

import { isErr, tryAsync } from "../lib/result.js";
import type { WidgetMetaEntry } from "../widgets/index.js";

import {
  familiesWithWidgets,
  clampIndex,
  filterWidgets,
  selectedAt,
  variantRows,
  widgetsInFamily,
} from "./picker.js";
import type { SaveTracker } from "./mount.js";
import { isAddCell, type EditorAction, type EditorState } from "./state.js";

type Setter<T> = (next: T | ((prev: T) => T)) => void;

/** Inputs every handler needs. */
export interface PickerHandlerDeps {
  readonly state: EditorState;
  readonly dispatch: Dispatch<EditorAction>;
  readonly widgetEntries: readonly WidgetMetaEntry[];
  readonly usedTypes: ReadonlySet<string>;
  readonly stepQuery: string;
  readonly stepHighlight: number;
  readonly setStepQuery: Setter<string>;
  readonly setStepHighlight: Setter<number>;
}

/** Extra inputs the edit-mode handler needs. */
export interface EditHandlerDeps extends PickerHandlerDeps {
  readonly exit: () => void;
  readonly onSave: () => Promise<void>;
  readonly onSaved: (saved: boolean) => void;
  readonly saveTracker: SaveTracker;
  readonly setStatusMessage: (message: string) => void;
}

/**
 * Picker step 1: pick a family or type to filter into a flat list.
 *
 *   - empty query  → ↑↓/↵ navigate and select a family;
 *   - typed query  → the group view collapses into a flat global
 *                    widget list filtered by substring; ↑↓/↵ act on
 *                    that list and Enter commits the widget directly.
 *                    Backspace through the query returns to the
 *                    group view.
 */
export function handlePickerGroupKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  const { dispatch, widgetEntries, usedTypes, stepQuery, stepHighlight } = deps;
  const searching = stepQuery.length > 0;

  if (key.escape) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.backspace || key.delete) {
    if (stepQuery.length === 0) return;
    deps.setStepQuery((q) => q.slice(0, -1));
    deps.setStepHighlight(0);
    return;
  }
  if (searching) {
    const matches = filterWidgets(widgetEntries, stepQuery, usedTypes);
    if (key.return) {
      const picked = selectedAt(matches, stepHighlight);
      if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
      return;
    }
    if (key.upArrow) {
      deps.setStepHighlight((h) => clampIndex(h - 1, matches.length));
      return;
    }
    if (key.downArrow) {
      deps.setStepHighlight((h) => clampIndex(h + 1, matches.length));
      return;
    }
  } else {
    const cats = familiesWithWidgets(widgetEntries, usedTypes);
    if (key.return) {
      const cat = selectedAt(cats, stepHighlight);
      if (cat) dispatch({ type: "pick-family", family: cat });
      return;
    }
    if (key.upArrow) {
      deps.setStepHighlight((h) => clampIndex(h - 1, cats.length));
      return;
    }
    if (key.downArrow) {
      deps.setStepHighlight((h) => clampIndex(h + 1, cats.length));
      return;
    }
  }
  /*
   * Any printable key extends the search query and flips the view to
   * flat results on the next render.
   */
  if (input.length === 1 && input >= " " && !key.ctrl && !key.meta) {
    deps.setStepQuery((q) => q + input);
    deps.setStepHighlight(0);
  }
}

/** Picker step 2: narrow to a widget within the chosen family. */
export function handlePickerWidgetKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  const { state, dispatch, widgetEntries, usedTypes, stepQuery, stepHighlight } = deps;
  if (state.mode === "edit") return; // TS narrowing; the dispatcher only routes here in picker-widget mode.
  const family = state.pickerDraft.family;
  if (!family) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.escape) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.return) {
    const matches = widgetsInFamily(widgetEntries, family, stepQuery, usedTypes);
    const picked = selectedAt(matches, stepHighlight);
    if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
    return;
  }
  if (key.upArrow) {
    const matches = widgetsInFamily(widgetEntries, family, stepQuery, usedTypes);
    deps.setStepHighlight((h) => clampIndex(h - 1, matches.length));
    return;
  }
  if (key.downArrow) {
    const matches = widgetsInFamily(widgetEntries, family, stepQuery, usedTypes);
    deps.setStepHighlight((h) => clampIndex(h + 1, matches.length));
    return;
  }
  if (key.backspace || key.delete) {
    deps.setStepQuery((q) => q.slice(0, -1));
    deps.setStepHighlight(0);
    return;
  }
  if (input.length === 1 && input >= " " && !key.ctrl && !key.meta) {
    deps.setStepQuery((q) => q + input);
    deps.setStepHighlight(0);
  }
}

/** Picker step 3: pick a variant of the chosen widget. */
export function handlePickerVariantKey(
  _input: string,
  key: KeyEvent,
  deps: PickerHandlerDeps,
): void {
  const { state, dispatch, stepHighlight } = deps;
  if (state.mode === "edit") return; // TS narrowing.
  const widgetType = state.pickerDraft.widgetType;
  if (!widgetType) {
    dispatch({ type: "picker-back" });
    return;
  }
  const rows = variantRows(widgetType, "fresh");
  if (key.escape) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.return) {
    const row = selectedAt(rows, stepHighlight);
    if (row) dispatch({ type: "pick-variant", variantId: row.id });
    return;
  }
  if (key.upArrow) {
    deps.setStepHighlight((h) => clampIndex(h - 1, rows.length));
    return;
  }
  if (key.downArrow) {
    deps.setStepHighlight((h) => clampIndex(h + 1, rows.length));
  }
}

/** Edit mode: layout-shaping keys plus save / exit. */
export function handleEditKey(input: string, key: KeyEvent, deps: EditHandlerDeps): void {
  const { state, dispatch, exit, onSave, onSaved, saveTracker, setStatusMessage } = deps;

  if (key.escape || input === "q") {
    onSaved(false);
    exit();
    return;
  }
  if (input === "s" || input === "S" || (key.ctrl && input === "s")) {
    if (saveTracker.inFlight) return;
    /*
     * Defense-in-depth: `onSave` catches its own errors today, but `void`
     * would silently swallow any rejection that ever leaked through.
     * Surface it in the status line instead.
     */
    tryAsync(onSave).then((r) => {
      if (isErr(r)) setStatusMessage(`save failed: ${r.error.message}`);
    });
    return;
  }
  if (key.leftArrow) {
    dispatch(key.shift ? { type: "move-widget", dx: -1 } : { type: "move-cursor", dx: -1 });
    return;
  }
  if (key.rightArrow) {
    dispatch(key.shift ? { type: "move-widget", dx: 1 } : { type: "move-cursor", dx: 1 });
    return;
  }
  if (key.upArrow) {
    dispatch(key.shift ? { type: "move-widget", dy: -1 } : { type: "move-cursor", dy: -1 });
    return;
  }
  if (key.downArrow) {
    dispatch(key.shift ? { type: "move-widget", dy: 1 } : { type: "move-cursor", dy: 1 });
    return;
  }
  if (key.return) {
    if (isAddCell(state)) dispatch({ type: "open-picker", intent: "add" });
    /*
     * On a populated widget ↵ is a no-op now — `a` opens the picker for
     * an insert at the cursor and `r` opens it in replace mode.
     */
    return;
  }
  if (input === "a") {
    dispatch({ type: "open-picker", intent: "add" });
    return;
  }
  if (input === "r") {
    dispatch({ type: "open-picker", intent: "replace" });
    return;
  }
  if (input === "d" || input === "x" || key.delete || key.backspace) {
    dispatch({ type: "delete" });
    return;
  }
}
