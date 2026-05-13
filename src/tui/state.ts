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
 * `widget` index therefore ranges `0..widgets.length` inclusive; when it
 * equals `widgets.length` the add-cell is selected. `currentWidget`
 * returns `undefined` in that case.
 *
 * State shape
 * -----------
 *   - `lines`        editable widget config — always exactly `MAX_LINES`
 *                    rows. `persist.ts` trims trailing empty rows on save
 *                    so the on-disk config stays clean.
 *   - `cursor`       selected `{ line, widget }`. `widget === widgets.length`
 *                    means the row's add-cell is selected.
 *   - `mode`         `"edit"` (the preview is the surface), `"picker"`
 *                    (the widget chooser is open), or `"options"` (the
 *                    per-widget options sheet is open).
 *   - `pickerTarget` while `mode === "picker"`, whether confirming
 *                    inserts a new widget or replaces the selected one.
 *   - `dirty`        whether anything changed since the last save.
 *
 * Movement is two-axis: `move-cursor` slides the *selection* over the
 * `MAX_LINES × (N + 1)` grid (the +1 is the add-cell); `move-widget`
 * carries the *selected widget*, with the selection following it.
 * Widgets cannot move onto the add-cell column — it stays last.
 */

import type { LineConfig, WidgetConfig } from "../config/types.js";

type MergeMode = NonNullable<WidgetConfig["merged"]>;

/** Hard cap on statusline rows the editor will create (mirrors `src/config/mutate.ts`). */
export const MAX_LINES = 3;

export type EditorMode = "edit" | "picker" | "options";
export type PickerTarget = "insert" | "replace";

export interface EditorCursor {
  readonly line: number;
  /** `0..widgets.length`. `widget === widgets.length` selects the row's add-cell. */
  readonly widget: number;
}

export interface EditorState {
  readonly lines: readonly LineConfig[];
  readonly cursor: EditorCursor;
  readonly mode: EditorMode;
  readonly pickerTarget: PickerTarget;
  readonly dirty: boolean;
}

export type EditorAction =
  // ── selection / widget movement ──────────────────────────────────────────
  | { readonly type: "move-cursor"; readonly dx?: number; readonly dy?: number }
  | { readonly type: "move-widget"; readonly dx?: number; readonly dy?: number }
  // ── structural edits ─────────────────────────────────────────────────────
  | { readonly type: "add"; readonly widgetType: string }
  | { readonly type: "delete" }
  // ── widget toggles / options ─────────────────────────────────────────────
  | { readonly type: "toggle-hidden" }
  | { readonly type: "toggle-raw" }
  | { readonly type: "cycle-merge" }
  | { readonly type: "set-option"; readonly key: string; readonly value: unknown }
  // ── overlay mode ─────────────────────────────────────────────────────────
  | { readonly type: "open-picker"; readonly target: PickerTarget }
  | { readonly type: "close-picker" }
  | { readonly type: "apply-picker"; readonly widgetType: string }
  | { readonly type: "open-options" }
  | { readonly type: "close-options" }
  // ── dirty bookkeeping ────────────────────────────────────────────────────
  | { readonly type: "mark-clean" }
  | { readonly type: "mark-dirty" };

const MERGE_CYCLE: readonly MergeMode[] = ["off", "merge", "merge-no-padding"];
const FORBIDDEN_OPTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Pad `lines` to exactly `MAX_LINES` empty-row entries so every grid slot is real. */
function padToMaxLines(lines: readonly LineConfig[]): readonly LineConfig[] {
  const trimmed = lines.slice(0, MAX_LINES).map((l) => ({ widgets: [...l.widgets] }));
  while (trimmed.length < MAX_LINES) trimmed.push({ widgets: [] });
  return trimmed;
}

export function initialState(lines: readonly LineConfig[]): EditorState {
  const padded = padToMaxLines(lines);
  const first = padded[0]!; // padded length is always MAX_LINES
  // Land on the first row's first widget when one exists; otherwise on its
  // add-cell (column 0 == widgets.length when empty).
  return Object.freeze({
    lines: padded,
    cursor: { line: 0, widget: first.widgets.length > 0 ? 0 : 0 },
    mode: "edit",
    pickerTarget: "insert",
    dirty: false,
  });
}

export function reduce(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "move-cursor":
      return moveCursor(state, action.dx ?? 0, action.dy ?? 0);
    case "move-widget":
      return moveWidget(state, action.dx ?? 0, action.dy ?? 0);
    case "add":
      return insertWidget(state, action.widgetType);
    case "delete":
      return deleteWidget(state);
    case "toggle-hidden":
      return mutateCurrent(state, (w) => ({ ...w, hidden: !(w.hidden ?? false) }));
    case "toggle-raw":
      return mutateCurrent(state, (w) => ({ ...w, rawValue: !(w.rawValue ?? false) }));
    case "cycle-merge":
      return mutateCurrent(state, (w) => ({ ...w, merged: nextMerge(w.merged) }));
    case "set-option":
      return setOption(state, action.key, action.value);
    case "open-picker":
      return openPicker(state, action.target);
    case "close-picker":
      return state.mode === "picker" ? { ...state, mode: "edit" } : state;
    case "apply-picker":
      return applyPicker(state, action.widgetType);
    case "open-options":
      return currentWidget(state) ? { ...state, mode: "options" } : state;
    case "close-options":
      return state.mode === "options" ? { ...state, mode: "edit" } : state;
    case "mark-clean":
      return state.dirty ? { ...state, dirty: false } : state;
    case "mark-dirty":
      return state.dirty ? state : { ...state, dirty: true };
  }
}

// ─── selectors ──────────────────────────────────────────────────────────────

function lineAt(state: EditorState, line: number): LineConfig | undefined {
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
  if (state.cursor.widget >= line.widgets.length) return undefined; // add-cell
  return line.widgets[state.cursor.widget];
}

// ─── movement ───────────────────────────────────────────────────────────────

function moveCursor(state: EditorState, dx: number, dy: number): EditorState {
  if (state.mode !== "edit") return state;
  const line = clamp(state.cursor.line + dy, 0, state.lines.length - 1);
  const count = widgetCountAt(state, line);
  // Inclusive max — the add-cell sits at column `count`.
  const maxCol = count;
  // `dy` keeps the column where it can; `dx` slides within the row.
  const base = dy !== 0 ? state.cursor.widget : state.cursor.widget + dx;
  const widget = clamp(base, 0, maxCol);
  if (line === state.cursor.line && widget === state.cursor.widget) return state;
  return { ...state, cursor: { line, widget } };
}

function moveWidget(state: EditorState, dx: number, dy: number): EditorState {
  if (state.mode !== "edit" || !currentWidget(state)) return state;
  if (dy === 0) return shiftWithinRow(state, dx);
  return shiftAcrossRows(state, dy < 0 ? -1 : 1);
}

function shiftWithinRow(state: EditorState, dx: number): EditorState {
  if (dx === 0) return state;
  const line = currentLine(state);
  if (!line) return state;
  const from = state.cursor.widget;
  // Clamp to `widgets.length - 1` so a widget can never swap places with
  // the add-cell — the add-cell is always last.
  const to = clamp(from + dx, 0, line.widgets.length - 1);
  if (to === from) return state;
  const widgets = [...line.widgets];
  const [moved] = widgets.splice(from, 1);
  if (!moved) return state;
  widgets.splice(to, 0, moved);
  return {
    ...state,
    lines: replaceLine(state.lines, state.cursor.line, { widgets }),
    cursor: { line: state.cursor.line, widget: to },
    dirty: true,
  };
}

function shiftAcrossRows(state: EditorState, dir: -1 | 1): EditorState {
  const fromLine = state.cursor.line;
  const toLine = fromLine + dir;
  if (toLine < 0 || toLine >= state.lines.length) return state;
  const source = lineAt(state, fromLine);
  const dest = lineAt(state, toLine);
  if (!source || !dest) return state;
  const movedAt = state.cursor.widget;
  const moved = source.widgets[movedAt];
  if (!moved) return state;

  const srcWidgets = [...source.widgets];
  srcWidgets.splice(movedAt, 1);
  const dstWidgets = [...dest.widgets, moved]; // append before the destination add-cell
  const insertAt = dest.widgets.length;

  let lines: readonly LineConfig[] = replaceLine(state.lines, fromLine, { widgets: srcWidgets });
  lines = replaceLine(lines, toLine, { widgets: dstWidgets });
  return { ...state, lines, cursor: { line: toLine, widget: insertAt }, dirty: true };
}

// ─── structural edits ───────────────────────────────────────────────────────

function insertWidget(state: EditorState, widgetType: string): EditorState {
  if (!widgetType) return state.mode === "edit" ? state : { ...state, mode: "edit" };
  const lineIdx = state.cursor.line;
  const line = lineAt(state, lineIdx) ?? { widgets: [] };
  // From the add-cell ⇒ append at the end. From a widget ⇒ insert after it.
  const onAdd = state.cursor.widget >= line.widgets.length;
  const insertAt = onAdd ? line.widgets.length : state.cursor.widget + 1;
  const widgets = [
    ...line.widgets.slice(0, insertAt),
    { type: widgetType },
    ...line.widgets.slice(insertAt),
  ];
  return {
    ...state,
    lines: replaceLine(state.lines, lineIdx, { widgets }),
    cursor: { line: lineIdx, widget: insertAt },
    mode: "edit",
    dirty: true,
  };
}

function deleteWidget(state: EditorState): EditorState {
  const line = currentLine(state);
  if (!line || state.cursor.widget >= line.widgets.length) return state; // add-cell
  const widgets = [
    ...line.widgets.slice(0, state.cursor.widget),
    ...line.widgets.slice(state.cursor.widget + 1),
  ];
  return {
    ...state,
    lines: replaceLine(state.lines, state.cursor.line, { widgets }),
    cursor: {
      line: state.cursor.line,
      // Re-anchor onto the surviving column, clamping into the new row
      // width — `widgets.length` is the add-cell when the row empties.
      widget: Math.min(state.cursor.widget, widgets.length),
    },
    dirty: true,
  };
}

// ─── overlay mode ───────────────────────────────────────────────────────────

function openPicker(state: EditorState, target: PickerTarget): EditorState {
  const effective: PickerTarget =
    target === "replace" && currentWidget(state) ? "replace" : "insert";
  return { ...state, mode: "picker", pickerTarget: effective };
}

function applyPicker(state: EditorState, widgetType: string): EditorState {
  if (state.mode !== "picker") return state;
  if (!widgetType) return { ...state, mode: "edit" };
  if (state.pickerTarget === "replace" && currentWidget(state)) {
    return mutateCurrent({ ...state, mode: "edit" }, (w) => ({ ...w, type: widgetType }));
  }
  return insertWidget(state, widgetType);
}

function setOption(state: EditorState, key: string, value: unknown): EditorState {
  if (typeof key !== "string" || key.trim() === "" || FORBIDDEN_OPTION_KEYS.has(key)) return state;
  return mutateCurrent(state, (w) => ({ ...w, options: { ...(w.options ?? {}), [key]: value } }));
}

// ─── internals ──────────────────────────────────────────────────────────────

function mutateCurrent(state: EditorState, fn: (w: WidgetConfig) => WidgetConfig): EditorState {
  const line = currentLine(state);
  if (!line || state.cursor.widget >= line.widgets.length) return state; // add-cell — nothing to mutate
  const target = line.widgets[state.cursor.widget];
  if (!target) return state;
  const next = fn(target);
  if (next === target) return state;
  const widgets = [
    ...line.widgets.slice(0, state.cursor.widget),
    next,
    ...line.widgets.slice(state.cursor.widget + 1),
  ];
  return { ...state, lines: replaceLine(state.lines, state.cursor.line, { widgets }), dirty: true };
}

function replaceLine(
  lines: readonly LineConfig[],
  index: number,
  line: LineConfig,
): readonly LineConfig[] {
  const next = [...lines];
  next[index] = line;
  return next;
}

function nextMerge(current: MergeMode | undefined): MergeMode {
  const idx = MERGE_CYCLE.indexOf(current ?? "off");
  return MERGE_CYCLE[(idx + 1) % MERGE_CYCLE.length] ?? "off";
}

function clamp(value: number, low: number, high: number): number {
  if (high < low) return low;
  if (value < low) return low;
  if (value > high) return high;
  return value;
}
