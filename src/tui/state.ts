/**
 * Pure state machine for the `agentline config` TUI editor (§1.1 F10).
 *
 * The Ink renderer is a thin view over this reducer; keeping the logic
 * pure means tests never drive Ink and the cold-start budget is
 * unaffected — this module imports neither Ink nor React.
 *
 * State shape:
 *
 *   - `lines`        the editable widget config (mirror of
 *                    `AgentlineConfig.lines`); capped at `MAX_LINES`.
 *   - `cursor`       selected `{ line, widget }`. `widget === -1` means
 *                    the line is empty / nothing is selected.
 *   - `mode`         `"edit"` (the layout view), `"picker"` (the
 *                    insert/replace widget chooser is open), or
 *                    `"options"` (the per-widget options sheet is open).
 *   - `pickerTarget` while `mode === "picker"`, whether confirming
 *                    inserts a new widget at the cursor or replaces the
 *                    selected one.
 *   - `dirty`        whether anything changed since the last save.
 *
 * Movement is two-axis: `move-cursor` slides the *selection* (the widget
 * stays put); `move-widget` carries the *selected widget* (the selection
 * follows it). Both respect the row count and the `MAX_LINES` cap; moving
 * a widget down off the last row appends a new row when there is headroom.
 * Picker filter text / highlight and in-progress option edits live in the
 * view components — this reducer only tracks `mode`/`pickerTarget` and
 * applies committed results.
 */

import type { LineConfig, WidgetConfig } from "../config/types.js";

type MergeMode = NonNullable<WidgetConfig["merged"]>;

/** Hard cap on statusline rows the editor will create (mirrors `src/config/mutate.ts`). */
export const MAX_LINES = 3;

export type EditorMode = "edit" | "picker" | "options";
export type PickerTarget = "insert" | "replace";

export interface EditorCursor {
  readonly line: number;
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
  // ── deprecated single-line aliases (kept for callers / tests using them) ──
  | { readonly type: "navigate"; readonly delta: number }
  | { readonly type: "select-widget"; readonly delta: number }
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

export function initialState(lines: readonly LineConfig[]): EditorState {
  const trimmed = lines.length > 0 ? lines.slice(0, MAX_LINES) : [{ widgets: [] }];
  const first = trimmed[0];
  return Object.freeze({
    lines: trimmed,
    cursor: { line: 0, widget: first && first.widgets.length > 0 ? 0 : -1 },
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
    case "navigate":
    case "select-widget":
      return moveCursor(state, action.delta, 0);
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

function currentLine(state: EditorState): LineConfig | undefined {
  return lineAt(state, state.cursor.line);
}

export function currentWidget(state: EditorState): WidgetConfig | undefined {
  const line = currentLine(state);
  if (!line || state.cursor.widget < 0) return undefined;
  return line.widgets[state.cursor.widget];
}

// ─── movement ───────────────────────────────────────────────────────────────

function moveCursor(state: EditorState, dx: number, dy: number): EditorState {
  if (state.mode !== "edit") return state;
  const line = clamp(state.cursor.line + dy, 0, state.lines.length - 1);
  const target = lineAt(state, line);
  const count = target ? target.widgets.length : 0;
  // dy keeps the column where it can; dx slides within the row.
  const base = dy !== 0 ? state.cursor.widget : state.cursor.widget + dx;
  const widget = count === 0 ? -1 : clamp(base < 0 ? 0 : base, 0, count - 1);
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
  if (toLine < 0 || toLine >= MAX_LINES) return state;
  const source = lineAt(state, fromLine);
  if (!source) return state;
  const movedAt = state.cursor.widget;
  const moved = source.widgets[movedAt];
  if (!moved) return state;

  const lines = state.lines.map((l) => ({ widgets: [...l.widgets] }));
  while (lines.length <= toLine) lines.push({ widgets: [] }); // pad to reach a new last row
  const src = lines[fromLine];
  const dst = lines[toLine];
  if (!src || !dst) return state;
  src.widgets.splice(movedAt, 1);
  const insertAt = dst.widgets.length; // append on the destination row
  dst.widgets.splice(insertAt, 0, moved);
  return { ...state, lines, cursor: { line: toLine, widget: insertAt }, dirty: true };
}

// ─── structural edits ───────────────────────────────────────────────────────

function insertWidget(state: EditorState, widgetType: string): EditorState {
  if (!widgetType) return state.mode === "edit" ? state : { ...state, mode: "edit" };
  const lineIdx = state.cursor.line;
  const line = lineAt(state, lineIdx) ?? { widgets: [] };
  const insertAt = state.cursor.widget < 0 ? line.widgets.length : state.cursor.widget + 1;
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
  if (!line || state.cursor.widget < 0) return state;
  const widgets = [
    ...line.widgets.slice(0, state.cursor.widget),
    ...line.widgets.slice(state.cursor.widget + 1),
  ];
  return {
    ...state,
    lines: replaceLine(state.lines, state.cursor.line, { widgets }),
    cursor: {
      line: state.cursor.line,
      widget: widgets.length === 0 ? -1 : Math.min(state.cursor.widget, widgets.length - 1),
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
  if (!line || state.cursor.widget < 0) return state;
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
