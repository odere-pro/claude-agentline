/**
 * Per-mode keypress handlers for the TUI editor.
 *
 * Each `handle*Key(input, key, deps)` is a plain function lifted out of
 * `use-editor-input.ts`. The hook builds one `deps` bag and forwards
 * `useInput` to the right handler; every side effect flows through a
 * callback in `deps`, so the handlers are trivially testable without
 * mounting Ink.
 */

import type { Key as KeyEvent } from "ink";
import type { Dispatch } from "react";

import { isErr, tryAsync } from "../../core/lib/result.js";
import type { WidgetMetaEntry } from "../../widgets/index.js";

import {
  familiesWithWidgets,
  filterWidgets,
  selectedAt,
  variantRows,
  widgetsInFamily,
  wrapIndex,
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
 * Strip control characters (C0 range + DEL) from typed or pasted input,
 * returning `""` when nothing printable remains. Ink delivers a paste as a
 * single multi-character `useInput` chunk, so the text-entry handlers route
 * `input` through here instead of gating on `input.length === 1`: a pasted
 * URL arrives intact, and any embedded newline / tab collapses out so the
 * single-line fields stay single-line.
 */
export function sanitizeTypedInput(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x20 && code !== 0x7f) out += ch;
  }
  return out;
}

/**
 * Picker step 1a: family browser (the default view).
 *
 *   - ↑↓/↵ navigate and select a family; Enter dispatches `pick-family`.
 *   - `/` switches into flat-search mode (`picker-search`).
 *   - Esc returns to edit mode.
 */
export function handlePickerGroupKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  const { dispatch, widgetEntries, usedTypes, stepHighlight } = deps;

  if (key.escape || key.leftArrow) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (input === "/") {
    dispatch({ type: "open-search" });
    return;
  }
  const cats = familiesWithWidgets(widgetEntries, usedTypes);
  if (key.return || key.rightArrow) {
    const cat = selectedAt(cats, stepHighlight);
    if (cat) dispatch({ type: "pick-family", family: cat });
    return;
  }
  if (key.upArrow) {
    deps.setStepHighlight((h) => wrapIndex(h - 1, cats.length));
    return;
  }
  if (key.downArrow) {
    deps.setStepHighlight((h) => wrapIndex(h + 1, cats.length));
  }
}

/** Picker step 1b: narrow to a widget within the chosen family. */
export function handlePickerWidgetKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  const { state, dispatch, widgetEntries, usedTypes, stepQuery, stepHighlight } = deps;
  if (state.mode === "edit") return; // TS narrowing; the dispatcher only routes here in picker-widget mode.
  const family = state.pickerDraft.family;
  if (!family) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.escape || key.leftArrow) {
    dispatch({ type: "picker-back" });
    return;
  }
  const matches = widgetsInFamily(widgetEntries, family, stepQuery, usedTypes);
  if (key.return || key.rightArrow) {
    const picked = selectedAt(matches, stepHighlight);
    if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
    return;
  }
  if (key.upArrow) {
    deps.setStepHighlight((h) => wrapIndex(h - 1, matches.length));
    return;
  }
  if (key.downArrow) {
    deps.setStepHighlight((h) => wrapIndex(h + 1, matches.length));
    return;
  }
  if (key.backspace || key.delete) {
    if (stepQuery.length === 0) return;
    deps.setStepQuery((q) => q.slice(0, -1));
    deps.setStepHighlight(0);
    return;
  }
  if (!key.ctrl && !key.meta) {
    const typed = sanitizeTypedInput(input);
    if (typed) {
      deps.setStepQuery((q) => q + typed);
      deps.setStepHighlight(0);
    }
  }
}

/**
 * Picker step 1c: flat search across every catalogued widget.
 *
 * Entered from the group view via `/`. Printable keys extend the query;
 * Enter commits the highlighted widget; Esc returns to the group view
 * (not edit mode — back-stepping out of search lands the user where
 * they came from).
 */
export function handlePickerSearchKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  const { dispatch, widgetEntries, usedTypes, stepQuery, stepHighlight } = deps;

  if (key.escape || key.leftArrow) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.backspace || key.delete) {
    if (stepQuery.length === 0) return;
    deps.setStepQuery((q) => q.slice(0, -1));
    deps.setStepHighlight(0);
    return;
  }
  const matches = filterWidgets(widgetEntries, stepQuery, usedTypes);
  if (key.return || key.rightArrow) {
    const picked = selectedAt(matches, stepHighlight);
    if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
    return;
  }
  if (key.upArrow) {
    deps.setStepHighlight((h) => wrapIndex(h - 1, matches.length));
    return;
  }
  if (key.downArrow) {
    deps.setStepHighlight((h) => wrapIndex(h + 1, matches.length));
    return;
  }
  if (!key.ctrl && !key.meta) {
    const typed = sanitizeTypedInput(input);
    if (typed) {
      deps.setStepQuery((q) => q + typed);
      deps.setStepHighlight(0);
    }
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
  if (key.escape || key.leftArrow) {
    dispatch({ type: "picker-back" });
    return;
  }
  if (key.return || key.rightArrow) {
    const row = selectedAt(rows, stepHighlight);
    if (row) dispatch({ type: "pick-variant", variantId: row.id });
    return;
  }
  if (key.upArrow) {
    deps.setStepHighlight((h) => wrapIndex(h - 1, rows.length));
    return;
  }
  if (key.downArrow) {
    deps.setStepHighlight((h) => wrapIndex(h + 1, rows.length));
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
    if (!key.shift && isAddCell(state)) {
      // → on the +add cell enters the picker, mirroring ↵.
      dispatch({ type: "open-picker", intent: "add" });
      return;
    }
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
