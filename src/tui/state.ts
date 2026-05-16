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
 *   step 1 — `picker-group`   — pick a family (`session`, `git`, …).
 *   step 2 — `picker-widget`  — pick a widget within the chosen family.
 *   step 3 — `picker-variant` — pick a variant (same widget, different
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
 *   - `lines`        editable widget config — always exactly `MAX_LINES`
 *                    rows. `persist.ts` trims trailing empty rows on save
 *                    so the on-disk config stays clean.
 *   - `cursor`       selected `{ line, widget }`. `widget === widgets.length`
 *                    means the row's add-cell is selected.
 *   - `mode`         `"edit"` or one of the three `picker-*` steps.
 *   - `pickerTarget` *picker variant only* — what to do when the variant
 *                    step confirms: `insert` at `(line, index)` or
 *                    `replace` the widget at `(line, index)`.
 *   - `pickerDraft`  *picker variant only* — the choices accumulated so
 *                    far during the drill-down.
 *   - `dirty`        whether anything changed since the last save.
 */

import { MAX_LINES } from "../config/mutate.js";
import type { LineConfig, WidgetConfig } from "../config/types.js";
import type { WidgetFamily } from "../widgets/catalog.js";

import { deleteWidget, moveCursor, moveWidget, setOption } from "./state-mutations.js";
import {
  backToEdit,
  openPicker,
  pickFamily,
  pickVariant,
  pickWidget,
  pickerBack,
} from "./state-picker.js";

export { MAX_LINES };

export type EditorMode = "edit" | "picker-group" | "picker-widget" | "picker-variant";

export type EditorPickerMode = "picker-group" | "picker-widget" | "picker-variant";

export type PickerTargetKind = "insert" | "replace";

export interface PickerTarget {
  readonly kind: PickerTargetKind;
  readonly line: number;
  readonly index: number;
}

export interface PickerDraft {
  readonly family?: WidgetFamily;
  readonly widgetType?: string;
}

export interface EditorCursor {
  readonly line: number;
  /** `0..widgets.length`. `widget === widgets.length` selects the row's add-cell. */
  readonly widget: number;
}

interface EditorStateBase {
  readonly lines: readonly LineConfig[];
  readonly cursor: EditorCursor;
  readonly dirty: boolean;
  /**
   * Memento — snapshot of `lines` at the last save (or at initial
   * load). `revert` restores from this snapshot, discarding any
   * unsaved edits. `mark-clean` refreshes it on successful save.
   */
  readonly lastSaved: EditorSnapshot;
}

export interface EditorEditState extends EditorStateBase {
  readonly mode: "edit";
}

export interface EditorPickerState extends EditorStateBase {
  readonly mode: EditorPickerMode;
  readonly pickerTarget: PickerTarget;
  readonly pickerDraft: PickerDraft;
}

export type EditorState = EditorEditState | EditorPickerState;

export interface EditorSnapshot {
  readonly lines: readonly LineConfig[];
}

export type EditorAction =
  // ── selection / widget movement ──────────────────────────────────────────
  | { readonly type: "move-cursor"; readonly dx?: number; readonly dy?: number }
  | { readonly type: "move-widget"; readonly dx?: number; readonly dy?: number }
  // ── structural edits ─────────────────────────────────────────────────────
  | { readonly type: "delete" }
  // ── widget option mutators (CLI / programmatic only) ─────────────────────
  | { readonly type: "set-option"; readonly key: string; readonly value: unknown }
  // ── picker drill-down (add / replace) ────────────────────────────────────
  | { readonly type: "open-picker"; readonly intent: "add" | "replace" }
  | { readonly type: "pick-family"; readonly family: WidgetFamily }
  | { readonly type: "pick-widget"; readonly widgetType: string }
  | { readonly type: "pick-variant"; readonly variantId: string | null }
  | { readonly type: "picker-back" }
  | { readonly type: "close-picker" }
  // ── dirty bookkeeping ────────────────────────────────────────────────────
  | { readonly type: "mark-clean" }
  | { readonly type: "mark-dirty" }
  // ── memento (discard unsaved edits, restore last-saved snapshot) ─────────
  | { readonly type: "revert" };

/** Pad `lines` to exactly `MAX_LINES` empty-row entries so every grid slot is real. */
export function padToMaxLines(lines: readonly LineConfig[]): readonly LineConfig[] {
  const trimmed = lines.slice(0, MAX_LINES).map((l) => ({ widgets: [...l.widgets] }));
  while (trimmed.length < MAX_LINES) trimmed.push({ widgets: [] });
  return trimmed;
}

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

// ─── selectors ──────────────────────────────────────────────────────────────

export function lineAt(state: EditorState, line: number): LineConfig | undefined {
  return state.lines[line];
}

export function currentLine(state: EditorState): LineConfig | undefined {
  return lineAt(state, state.cursor.line);
}

export function widgetCountAt(state: EditorState, line: number): number {
  return lineAt(state, line)?.widgets.length ?? 0;
}

/** `true` when the cursor sits on the trailing "+ add widget" cell of its row. */
export function isAddCell(state: EditorState): boolean {
  const line = currentLine(state);
  return !!line && state.cursor.widget === line.widgets.length;
}

export function currentWidget(state: EditorState): WidgetConfig | undefined {
  const line = currentLine(state);
  if (!line) return undefined;
  if (state.cursor.widget >= line.widgets.length) return undefined;
  return line.widgets[state.cursor.widget];
}

export function isPickerMode(mode: EditorMode): boolean {
  return mode === "picker-group" || mode === "picker-widget" || mode === "picker-variant";
}

// ─── shared internals (used by state-mutations.ts and state-picker.ts) ──────

function clampCursor(cursor: EditorCursor, lines: readonly LineConfig[]): EditorCursor {
  const line = clamp(cursor.line, 0, Math.max(0, lines.length - 1));
  const count = lines[line]?.widgets.length ?? 0;
  return { line, widget: clamp(cursor.widget, 0, count) };
}

export function replaceLine(
  lines: readonly LineConfig[],
  index: number,
  line: LineConfig,
): readonly LineConfig[] {
  const next = [...lines];
  next[index] = line;
  return next;
}

export function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}

export function clamp(value: number, low: number, high: number): number {
  if (high < low) return low;
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export const FORBIDDEN_OPTION_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);
