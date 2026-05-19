/**
 * Leaf module for the TUI editor state machine — types and pure
 * selectors with no inbound imports from sibling state files.
 *
 * Both `state-mutations.ts` and `state-picker.ts` import from here
 * rather than from `state.ts`, which breaks the A↔B↔A runtime cycles
 * those modules would otherwise form with the reducer entry point.
 *
 * See `state.ts` for the prose overview of the editor grid model and
 * picker drill-down; this module only defines the types and primitives
 * those flows operate on.
 */

import { MAX_LINES } from "../config/mutate.js";
import type { LineConfig, WidgetConfig } from "../config/types.js";
import type { WidgetFamily } from "../widgets/catalog.js";

export { MAX_LINES };

export type EditorMode =
  | "edit"
  | "picker-group"
  | "picker-widget"
  | "picker-search"
  | "picker-variant";

export type EditorPickerMode =
  | "picker-group"
  | "picker-widget"
  | "picker-search"
  | "picker-variant";

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
  | { readonly type: "move-cursor"; readonly dx?: number; readonly dy?: number }
  | { readonly type: "move-widget"; readonly dx?: number; readonly dy?: number }
  | { readonly type: "delete" }
  | { readonly type: "set-option"; readonly key: string; readonly value: unknown }
  | { readonly type: "open-picker"; readonly intent: "add" | "replace" }
  | { readonly type: "open-search" }
  | { readonly type: "pick-family"; readonly family: WidgetFamily }
  | { readonly type: "pick-widget"; readonly widgetType: string }
  | { readonly type: "pick-variant"; readonly variantId: string | null }
  | { readonly type: "picker-back" }
  | { readonly type: "close-picker" }
  | { readonly type: "mark-clean" }
  | { readonly type: "mark-dirty" }
  | { readonly type: "revert" };

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
  return (
    mode === "picker-group" ||
    mode === "picker-widget" ||
    mode === "picker-search" ||
    mode === "picker-variant"
  );
}

// ─── pure helpers ───────────────────────────────────────────────────────────

/** Pad `lines` to exactly `MAX_LINES` empty-row entries so every grid slot is real. */
export function padToMaxLines(lines: readonly LineConfig[]): readonly LineConfig[] {
  const trimmed = lines.slice(0, MAX_LINES).map((l) => ({ widgets: [...l.widgets] }));
  while (trimmed.length < MAX_LINES) trimmed.push({ widgets: [] });
  return trimmed;
}

export function clampCursor(cursor: EditorCursor, lines: readonly LineConfig[]): EditorCursor {
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
