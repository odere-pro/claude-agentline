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
  clampCursor,
  padToMaxLines,
  type EditorAction,
  type EditorEditState,
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
  FORBIDDEN_OPTION_KEYS,
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
  });
}

export function reduce(state: EditorState, action: EditorAction): EditorState {
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
  }
}
