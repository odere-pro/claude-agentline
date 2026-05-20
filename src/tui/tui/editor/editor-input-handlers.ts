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

import { isErr, mapErr, tryAsync } from "../../../core/lib/result/result.js";
import { sanitizeCellText } from "../../../render/render/sanitize/sanitize.js";
import type { WidgetMetaEntry } from "../../../widgets/index.js";

import {
  familiesWithWidgets,
  filterWidgets,
  selectedAt,
  variantRows,
  widgetsInFamily,
  wrapIndex,
} from "../../picker/picker.js";
import type { SaveTracker } from "../mount.js";
import { isAddCell, type EditorAction, type EditorState } from "../../state/state.js";

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
 * Strip control characters (C0 + DEL + C1) from typed or pasted input,
 * returning `""` when nothing printable remains. Ink delivers a paste as a
 * single multi-character `useInput` chunk, so the text-entry handlers route
 * `input` through here instead of gating on `input.length === 1`: a pasted
 * URL arrives intact, and any embedded newline / tab collapses out so the
 * single-line fields stay single-line.
 *
 * Shares a single control-char policy with the render encoder seam
 * (`sanitizeCellText`) — they enforce the same regex so typed input and
 * widget-derived text cannot diverge on what counts as a printable byte.
 */
export function sanitizeTypedInput(input: string): string {
  return sanitizeCellText(input);
}

/**
 * Common picker navigation: Esc / ←  → `picker-back`, ↑↓ wrap-move the
 * highlight, ↵ / →  invoke `onPick` with the currently-highlighted
 * item. Returns `true` when it handled the key so callers can early-out
 * before falling through to mode-specific keys (typing, filter clear).
 */
function handlePickerNavigation<T>(
  key: KeyEvent,
  items: readonly T[],
  onPick: (item: T) => void,
  deps: PickerHandlerDeps,
): boolean {
  if (key.escape || key.leftArrow) {
    deps.dispatch({ type: "picker-back" });
    return true;
  }
  if (key.return || key.rightArrow) {
    const picked = selectedAt(items, deps.stepHighlight);
    if (picked) onPick(picked);
    return true;
  }
  if (key.upArrow) {
    deps.setStepHighlight((h) => wrapIndex(h - 1, items.length));
    return true;
  }
  if (key.downArrow) {
    deps.setStepHighlight((h) => wrapIndex(h + 1, items.length));
    return true;
  }
  return false;
}

/**
 * Common filter-input handling for the picker modes that maintain a
 * type-as-you-go query (widget mode, search mode). Returns `true` when
 * the key advanced the filter (backspace, printable input).
 */
function handlePickerFilterInput(input: string, key: KeyEvent, deps: PickerHandlerDeps): boolean {
  if (key.backspace || key.delete) {
    if (deps.stepQuery.length === 0) return true;
    deps.setStepQuery((q) => q.slice(0, -1));
    deps.setStepHighlight(0);
    return true;
  }
  if (!key.ctrl && !key.meta) {
    const typed = sanitizeTypedInput(input);
    if (typed) {
      deps.setStepQuery((q) => q + typed);
      deps.setStepHighlight(0);
      return true;
    }
  }
  return false;
}

/**
 * Picker step 1a: family browser (the default view).
 *
 *   - ↑↓/↵ navigate and select a family; Enter dispatches `pick-family`.
 *   - `/` switches into flat-search mode (`picker-search`).
 *   - Esc returns to edit mode.
 */
export function handlePickerGroupKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  if (input === "/") {
    deps.dispatch({ type: "open-search" });
    return;
  }
  const cats = familiesWithWidgets(deps.widgetEntries, deps.usedTypes);
  handlePickerNavigation(
    key,
    cats,
    (family) => deps.dispatch({ type: "pick-family", family }),
    deps,
  );
}

/** Picker step 1b: narrow to a widget within the chosen family. */
export function handlePickerWidgetKey(input: string, key: KeyEvent, deps: PickerHandlerDeps): void {
  const { state, dispatch, widgetEntries, usedTypes, stepQuery } = deps;
  if (state.mode === "edit") return; // TS narrowing; the dispatcher only routes here in picker-widget mode.
  const family = state.pickerDraft.family;
  if (!family) {
    dispatch({ type: "picker-back" });
    return;
  }
  const matches = widgetsInFamily(widgetEntries, family, stepQuery, usedTypes);
  if (
    handlePickerNavigation(
      key,
      matches,
      (m) => dispatch({ type: "pick-widget", widgetType: m.type }),
      deps,
    )
  ) {
    return;
  }
  handlePickerFilterInput(input, key, deps);
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
  const matches = filterWidgets(deps.widgetEntries, deps.stepQuery, deps.usedTypes);
  if (
    handlePickerNavigation(
      key,
      matches,
      (m) => deps.dispatch({ type: "pick-widget", widgetType: m.type }),
      deps,
    )
  ) {
    return;
  }
  handlePickerFilterInput(input, key, deps);
}

/** Picker step 3: pick a variant of the chosen widget. */
export function handlePickerVariantKey(
  _input: string,
  key: KeyEvent,
  deps: PickerHandlerDeps,
): void {
  const { state, dispatch } = deps;
  if (state.mode === "edit") return; // TS narrowing.
  const widgetType = state.pickerDraft.widgetType;
  if (!widgetType) {
    dispatch({ type: "picker-back" });
    return;
  }
  const rows = variantRows(widgetType, "fresh");
  handlePickerNavigation(
    key,
    rows,
    (row) => dispatch({ type: "pick-variant", variantId: row.id }),
    deps,
  );
}

/** Edit mode: layout-shaping keys plus save / exit. */
export function handleEditKey(input: string, key: KeyEvent, deps: EditHandlerDeps): void {
  if (key.escape || input === "q") {
    deps.onSaved(false);
    deps.exit();
    return;
  }
  if (key.ctrl && (input === "z" || input === "Z")) {
    // Ctrl+Shift+Z surfaces as input="Z"; treat as redo.
    deps.dispatch({ type: input === "Z" ? "redo" : "undo" });
    return;
  }
  if (key.ctrl && (input === "y" || input === "Y")) {
    deps.dispatch({ type: "redo" });
    return;
  }
  if (isSaveKey(input, key)) {
    triggerSave(deps);
    return;
  }
  if (handleEditArrowKey(key, deps)) return;
  if (key.return) {
    if (isAddCell(deps.state)) deps.dispatch({ type: "open-picker", intent: "add" });
    /*
     * On a populated widget ↵ is a no-op — `a` opens the picker for an
     * insert at the cursor and `r` opens it in replace mode.
     */
    return;
  }
  if (input === "a") deps.dispatch({ type: "open-picker", intent: "add" });
  else if (input === "r") deps.dispatch({ type: "open-picker", intent: "replace" });
  else if (input === "d" || input === "x" || key.delete || key.backspace) {
    deps.dispatch({ type: "delete" });
  }
}

function isSaveKey(input: string, key: KeyEvent): boolean {
  return input === "s" || input === "S" || Boolean(key.ctrl && input === "s");
}

/**
 * Fire the save callback and route any failure into the status line.
 *
 * `onSave` catches its own errors today, but the entire chain is wrapped
 * so a future leaked rejection (or one from `setStatusMessage` itself)
 * can't escape to Node's `unhandledRejection` and crash the editor.
 */
function triggerSave(deps: EditHandlerDeps): void {
  if (deps.saveTracker.inFlight) return;
  tryAsync(deps.onSave)
    .then((r) => mapErr(r, (e) => `save failed: ${e.message}`))
    .then((r) => {
      if (isErr(r)) deps.setStatusMessage(r.error);
    })
    .catch(() => undefined);
}

/**
 * Dispatch the appropriate cursor / widget movement for an arrow key, or
 * (on `→` while the cursor sits on the `+add` cell) open the picker.
 * Returns `true` when an arrow key was consumed.
 */
function handleEditArrowKey(key: KeyEvent, deps: EditHandlerDeps): boolean {
  if (key.leftArrow) {
    deps.dispatch(key.shift ? { type: "move-widget", dx: -1 } : { type: "move-cursor", dx: -1 });
    return true;
  }
  if (key.rightArrow) {
    if (!key.shift && isAddCell(deps.state)) {
      // → on the +add cell enters the picker, mirroring ↵.
      deps.dispatch({ type: "open-picker", intent: "add" });
      return true;
    }
    deps.dispatch(key.shift ? { type: "move-widget", dx: 1 } : { type: "move-cursor", dx: 1 });
    return true;
  }
  if (key.upArrow) {
    deps.dispatch(key.shift ? { type: "move-widget", dy: -1 } : { type: "move-cursor", dy: -1 });
    return true;
  }
  if (key.downArrow) {
    deps.dispatch(key.shift ? { type: "move-widget", dy: 1 } : { type: "move-cursor", dy: 1 });
    return true;
  }
  return false;
}
