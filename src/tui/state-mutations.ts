/**
 * Edit-mode mutation helpers for the TUI reducer.
 *
 * All helpers here take an `EditorState` and refuse to mutate when the
 * state is in a picker mode (the reducer is structured so these aren't
 * dispatched from picker modes, but defensive returns keep the helpers
 * pure and side-effect-free against any caller).
 */

import type { LineConfig, WidgetConfig } from "../config/types.js";

import {
  FORBIDDEN_OPTION_KEYS,
  clamp,
  currentLine,
  lineAt,
  replaceAt,
  replaceLine,
  widgetCountAt,
  type EditorState,
} from "./state.js";

export function moveCursor(state: EditorState, dx: number, dy: number): EditorState {
  if (state.mode !== "edit") return state;
  const line = clamp(state.cursor.line + dy, 0, state.lines.length - 1);
  const count = widgetCountAt(state, line);
  const maxCol = count; // inclusive — add-cell sits at column `count`
  const base = dy !== 0 ? state.cursor.widget : state.cursor.widget + dx;
  const widget = clamp(base, 0, maxCol);
  if (line === state.cursor.line && widget === state.cursor.widget) return state;
  return { ...state, cursor: { line, widget } };
}

export function moveWidget(state: EditorState, dx: number, dy: number): EditorState {
  if (state.mode !== "edit") return state;
  const line = currentLine(state);
  if (!line || state.cursor.widget >= line.widgets.length) return state;
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
  if (toLine < 0 || toLine >= state.lines.length) return state;
  const source = lineAt(state, fromLine);
  const dest = lineAt(state, toLine);
  if (!source || !dest) return state;
  const movedAt = state.cursor.widget;
  const moved = source.widgets[movedAt];
  if (!moved) return state;

  const srcWidgets = [...source.widgets];
  srcWidgets.splice(movedAt, 1);
  const dstWidgets = [...dest.widgets, moved];
  const insertAt = dest.widgets.length;

  let lines: readonly LineConfig[] = replaceLine(state.lines, fromLine, { widgets: srcWidgets });
  lines = replaceLine(lines, toLine, { widgets: dstWidgets });
  return { ...state, lines, cursor: { line: toLine, widget: insertAt }, dirty: true };
}

export function deleteWidget(state: EditorState): EditorState {
  const line = currentLine(state);
  if (!line || state.cursor.widget >= line.widgets.length) return state;
  const widgets = [
    ...line.widgets.slice(0, state.cursor.widget),
    ...line.widgets.slice(state.cursor.widget + 1),
  ];
  return {
    ...state,
    lines: replaceLine(state.lines, state.cursor.line, { widgets }),
    cursor: {
      line: state.cursor.line,
      widget: Math.min(state.cursor.widget, widgets.length),
    },
    dirty: true,
  };
}

export function setOption(state: EditorState, key: string, value: unknown): EditorState {
  if (typeof key !== "string" || key.trim() === "" || FORBIDDEN_OPTION_KEYS.has(key)) return state;
  return mutateCurrent(state, (w) => ({
    ...w,
    options: { ...(w.options ?? {}), [key]: value },
  }));
}

function mutateCurrent(state: EditorState, fn: (w: WidgetConfig) => WidgetConfig): EditorState {
  const line = currentLine(state);
  if (!line || state.cursor.widget >= line.widgets.length) return state;
  const target = line.widgets[state.cursor.widget];
  if (!target) return state;
  const next = fn(target);
  if (next === target) return state;
  const widgets = replaceAt(line.widgets, state.cursor.widget, next);
  return {
    ...state,
    lines: replaceLine(state.lines, state.cursor.line, { widgets }),
    dirty: true,
  };
}
