/**
 * Pure state machine for the `agentline config` TUI editor (§1.1 F10).
 *
 * The Ink renderer is a thin view over this reducer; keeping the logic
 * pure means tests never drive Ink and the cold-start budget is
 * unaffected — this module imports neither Ink nor React.
 *
 * The grid model
 * --------------
 * The editor works as a fixed 3-row grid (one row per `LineConfig`,
 * padded to `MAX_LINES`). Each row has `N` real widget cells plus one
 * synthetic **add-cell** at column `N` (the "+ add widget" affordance the
 * user navigates onto and presses `Enter` to insert). The cursor's
 * `widget` index ranges `0..widgets.length` inclusive; when it equals
 * `widgets.length` the add-cell is selected. `currentWidget` returns
 * `undefined` in that case.
 *
 * The picker drill-down
 * ---------------------
 * Add / replace share one drill-down owned by `state-picker.ts`:
 *
 *   step 1a — `picker-group`   — pick a family (`session`, `git`, …).
 *                                The default view when the picker opens.
 *                                `/` switches to `picker-search`.
 *   step 1b — `picker-widget`  — pick a widget within the chosen family.
 *   step 1c — `picker-search`  — flat-search across every catalogued
 *                                widget; entered from `picker-group` via
 *                                the `/` shortcut, `Esc` returns to it.
 *   step 2  — `picker-variant` — pick a variant (same widget, different
 *                                rendering) — *skipped* when the widget
 *                                has no `variants` in the catalogue.
 *
 * State shape
 * -----------
 * `EditorState` is a mode-indexed discriminated union: `pickerTarget` /
 * `pickerDraft` exist only on the picker variant, so accessing them in
 * edit code is a compile-time error rather than a silent read of a
 * stale field. Helpers in `state-mutations.ts` and `state-picker.ts`
 * narrow on `state.mode` at entry; the reducer below dispatches.
 *
 * Module split
 * ------------
 * Types and leaf selectors live in `state-core.ts`. `state-mutations.ts`
 * and `state-picker.ts` import only from core, so this module is free to
 * import from both of them without forming a runtime cycle.
 */

import type { LineConfig } from "../../data/config/types.js";

import {
  EMPTY_HISTORY,
  HISTORY_CAP,
  clampCursor,
  padToMaxLines,
  type EditorAction,
  type EditorEditState,
  type EditorHistory,
  type EditorHistoryEntry,
  type EditorState,
} from "./state-core.js";
import { deleteWidget, moveCursor, moveWidget, setOption } from "./state-mutations.js";
import {
  backToEdit,
  openPicker,
  openSearch,
  pickFamily,
  pickVariant,
  pickWidget,
  pickerBack,
} from "./state-picker.js";

export {
  EMPTY_HISTORY,
  FORBIDDEN_OPTION_KEYS,
  HISTORY_CAP,
  MAX_LINES,
  clamp,
  currentLine,
  currentWidget,
  isAddCell,
  isPickerMode,
  lineAt,
  padToMaxLines,
  replaceAt,
  replaceLine,
  widgetCountAt,
} from "./state-core.js";
export type {
  EditorAction,
  EditorCursor,
  EditorEditState,
  EditorHistory,
  EditorHistoryEntry,
  EditorMode,
  EditorPickerMode,
  EditorPickerState,
  EditorSnapshot,
  EditorState,
  PickerDraft,
  PickerTarget,
  PickerTargetKind,
} from "./state-core.js";

export function initialState(lines: readonly LineConfig[]): EditorEditState {
  const padded = padToMaxLines(lines);
  return Object.freeze<EditorEditState>({
    lines: padded,
    cursor: { line: 0, widget: 0 },
    mode: "edit",
    dirty: false,
    lastSaved: { lines: padded },
    history: EMPTY_HISTORY,
  });
}

export function reduce(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "undo") return undo(state);
  if (action.type === "redo") return redo(state);
  const next = reduceCore(state, action);
  return recordHistory(state, next);
}

function reduceCore(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "move-cursor":
      return moveCursor(state, action.dx ?? 0, action.dy ?? 0);
    case "move-widget":
      return moveWidget(state, action.dx ?? 0, action.dy ?? 0);
    case "delete":
      return deleteWidget(state);
    case "set-option":
      return setOption(state, action.key, action.value);
    case "open-picker":
      return openPicker(state, action.intent);
    case "open-search":
      return openSearch(state);
    case "pick-family":
      return pickFamily(state, action.family);
    case "pick-widget":
      return pickWidget(state, action.widgetType);
    case "pick-variant":
      return pickVariant(state, action.variantId);
    case "picker-back":
      return pickerBack(state);
    case "close-picker":
      return state.mode === "edit" ? state : backToEdit(state);
    case "mark-clean":
      /*
       * Refresh the memento on save so a subsequent `revert` returns
       * here, not to the original loaded config.
       */
      return {
        ...state,
        dirty: false,
        lastSaved: { lines: state.lines },
      };
    case "mark-dirty":
      return state.dirty ? state : { ...state, dirty: true };
    case "revert":
      if (!state.dirty) return state;
      return {
        ...state,
        lines: state.lastSaved.lines,
        dirty: false,
        /*
         * Pull cursor back into bounds in case the discarded edits had
         * extended a row beyond what the snapshot contains.
         */
        cursor: clampCursor(state.cursor, state.lastSaved.lines),
      };
    case "undo":
    case "redo":
      // Handled by the outer `reduce`; unreachable here but the switch
      // is exhaustive on the discriminated union.
      return state;
  }
}

/*
 * Push a `{lines, cursor}` snapshot of `prev` onto the undo stack
 * whenever the reduction actually changed the rendered config. Move /
 * picker / mark actions that leave `lines` referentially equal are
 * skipped so an undo press is never wasted on a cursor wiggle. Any
 * line-mutating action also clears the redo stack — a fresh branch of
 * edits invalidates the previously-redoable future.
 */
function recordHistory(prev: EditorState, next: EditorState): EditorState {
  if (prev.lines === next.lines) return next;
  const entry: EditorHistoryEntry = { lines: prev.lines, cursor: prev.cursor };
  const past = appendBounded(prev.history.past, entry, HISTORY_CAP);
  const history: EditorHistory = { past, future: EMPTY_HISTORY.future };
  return { ...next, history };
}

function undo(state: EditorState): EditorState {
  if (state.mode !== "edit") return state;
  const past = state.history.past;
  if (past.length === 0) return state;
  const entry = past[past.length - 1]!;
  const future: readonly EditorHistoryEntry[] = [
    ...state.history.future,
    { lines: state.lines, cursor: state.cursor },
  ];
  return {
    ...state,
    lines: entry.lines,
    cursor: clampCursor(entry.cursor, entry.lines),
    history: { past: past.slice(0, -1), future },
  };
}

function redo(state: EditorState): EditorState {
  if (state.mode !== "edit") return state;
  const future = state.history.future;
  if (future.length === 0) return state;
  const entry = future[future.length - 1]!;
  const past: readonly EditorHistoryEntry[] = appendBounded(
    state.history.past,
    { lines: state.lines, cursor: state.cursor },
    HISTORY_CAP,
  );
  return {
    ...state,
    lines: entry.lines,
    cursor: clampCursor(entry.cursor, entry.lines),
    history: { past, future: future.slice(0, -1) },
  };
}

function appendBounded<T>(items: readonly T[], item: T, cap: number): readonly T[] {
  const next = items.length >= cap ? items.slice(items.length - cap + 1) : [...items];
  next.push(item);
  return next;
}
