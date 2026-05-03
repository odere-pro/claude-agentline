/**
 * Pure state machine for the `agentline config` TUI editor (§1.1 F10).
 *
 * The Ink renderer (`app.tsx`) is a thin view over this reducer.
 * Keeping the logic pure means tests don't need to drive Ink at all
 * and the cold-start budget is unaffected — this module never imports
 * Ink or React.
 *
 * State shape:
 *
 *   - `lines`        the editable widget config (mirror of
 *                    `AgentlineConfig.lines`).
 *   - `cursor`       currently selected `{ line, widget }` pair;
 *                    `widget === -1` means "no widget selected"
 *                    (the line is empty or the user is past the end).
 *   - `dirty`        whether any change has been applied since
 *                    the last save.
 *
 * The reducer is exhaustive over `EditorAction` so the renderer can
 * dispatch by action id without running through a switch in two
 * places.
 */

import type { LineConfig, WidgetConfig } from "../config/types.js";

type MergeMode = NonNullable<WidgetConfig["merged"]>;

export interface EditorCursor {
  readonly line: number;
  readonly widget: number;
}

export interface EditorState {
  readonly lines: readonly LineConfig[];
  readonly cursor: EditorCursor;
  readonly dirty: boolean;
}

export type EditorAction =
  | { readonly type: "navigate"; readonly delta: number }
  | { readonly type: "select-widget"; readonly delta: number }
  | { readonly type: "add"; readonly widgetType: string }
  | { readonly type: "delete" }
  | { readonly type: "toggle-hidden" }
  | { readonly type: "toggle-raw" }
  | { readonly type: "cycle-merge" }
  | { readonly type: "set-type"; readonly widgetType: string }
  | { readonly type: "mark-clean" };

const MERGE_CYCLE: readonly MergeMode[] = ["off", "merge", "merge-no-padding"];

export function initialState(lines: readonly LineConfig[]): EditorState {
  const firstLine = lines[0];
  const widgetIdx = firstLine && firstLine.widgets.length > 0 ? 0 : -1;
  return Object.freeze({
    lines: lines.length > 0 ? lines : [{ widgets: [] }],
    cursor: { line: 0, widget: widgetIdx },
    dirty: false,
  });
}

export function reduce(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "navigate":
      return navigate(state, action.delta);
    case "select-widget":
      return selectWidget(state, action.delta);
    case "add":
      return addWidget(state, action.widgetType);
    case "delete":
      return deleteWidget(state);
    case "toggle-hidden":
      return mutateCurrent(state, (w) => ({ ...w, hidden: !(w.hidden ?? false) }));
    case "toggle-raw":
      return mutateCurrent(state, (w) => ({ ...w, rawValue: !(w.rawValue ?? false) }));
    case "cycle-merge":
      return mutateCurrent(state, (w) => ({ ...w, merged: nextMerge(w.merged) }));
    case "set-type":
      return mutateCurrent(state, (w) => ({ ...w, type: action.widgetType }));
    case "mark-clean":
      return state.dirty ? { ...state, dirty: false } : state;
  }
}

function nextMerge(current: MergeMode | undefined): MergeMode {
  const idx = MERGE_CYCLE.indexOf(current ?? "off");
  const next = MERGE_CYCLE[(idx + 1) % MERGE_CYCLE.length];
  return next ?? "off";
}

function currentLine(state: EditorState): LineConfig | undefined {
  return state.lines[state.cursor.line];
}

export function currentWidget(state: EditorState): WidgetConfig | undefined {
  const line = currentLine(state);
  if (!line) return undefined;
  if (state.cursor.widget < 0) return undefined;
  return line.widgets[state.cursor.widget];
}

function navigate(state: EditorState, delta: number): EditorState {
  const line = currentLine(state);
  if (!line || line.widgets.length === 0) return state;
  const next = clamp(state.cursor.widget + delta, 0, line.widgets.length - 1);
  if (next === state.cursor.widget) return state;
  return { ...state, cursor: { ...state.cursor, widget: next } };
}

function selectWidget(state: EditorState, delta: number): EditorState {
  // For a single-line editor `select-widget` is identical to navigate;
  // multi-line support arrives in a follow-up PR.
  return navigate(state, delta);
}

function addWidget(state: EditorState, widgetType: string): EditorState {
  if (!widgetType) return state;
  const lines = [...state.lines];
  const lineIdx = state.cursor.line;
  const line = lines[lineIdx] ?? { widgets: [] };
  const insertAt = state.cursor.widget < 0 ? line.widgets.length : state.cursor.widget + 1;
  const widgets = [
    ...line.widgets.slice(0, insertAt),
    { type: widgetType },
    ...line.widgets.slice(insertAt),
  ];
  lines[lineIdx] = { ...line, widgets };
  return {
    lines,
    cursor: { line: lineIdx, widget: insertAt },
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
  const lines = [...state.lines];
  lines[state.cursor.line] = { ...line, widgets };
  const nextWidget =
    widgets.length === 0
      ? -1
      : Math.min(state.cursor.widget, widgets.length - 1);
  return {
    lines,
    cursor: { line: state.cursor.line, widget: nextWidget },
    dirty: true,
  };
}

function mutateCurrent(
  state: EditorState,
  fn: (w: WidgetConfig) => WidgetConfig,
): EditorState {
  const line = currentLine(state);
  if (!line || state.cursor.widget < 0) return state;
  const target = line.widgets[state.cursor.widget];
  if (!target) return state;
  const widgets = [
    ...line.widgets.slice(0, state.cursor.widget),
    fn(target),
    ...line.widgets.slice(state.cursor.widget + 1),
  ];
  const lines = [...state.lines];
  lines[state.cursor.line] = { ...line, widgets };
  return { lines, cursor: state.cursor, dirty: true };
}

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}
