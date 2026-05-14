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
 * Add / replace share one drill-down:
 *
 *   step 1 — `picker-group`   — pick a category (`session`, `git`, …).
 *   step 2 — `picker-widget`  — pick a widget within the chosen category.
 *   step 3 — `picker-variant` — pick a variant (same widget, different
 *                                rendering) — *skipped* when the widget
 *                                has no `variants` in the catalogue.
 *
 * State shape
 * -----------
 *   - `lines`        editable widget config — always exactly `MAX_LINES`
 *                    rows. `persist.ts` trims trailing empty rows on save
 *                    so the on-disk config stays clean.
 *   - `cursor`       selected `{ line, widget }`. `widget === widgets.length`
 *                    means the row's add-cell is selected.
 *   - `mode`         `"edit"` or one of the three `picker-*` steps.
 *   - `pickerTarget` while a `picker-*` mode is active, what to do when
 *                    the variant step confirms — `insert` at `(line,index)`,
 *                    or `replace` the widget at `(line,index)`.
 *   - `pickerDraft`  the choices accumulated so far during the drill-down.
 *   - `dirty`        whether anything changed since the last save.
 */

import { MAX_LINES } from "../config/mutate.js";
import type { GlyphMode, LineConfig, WidgetConfig } from "../config/types.js";
import { widgetVariants, type WidgetCategory } from "../widgets/catalog.js";

export { MAX_LINES };

export type EditorMode = "edit" | "picker-group" | "picker-widget" | "picker-variant";

export type PickerTargetKind = "insert" | "replace";

export interface PickerTarget {
  readonly kind: PickerTargetKind;
  readonly line: number;
  readonly index: number;
}

export interface PickerDraft {
  readonly category?: WidgetCategory;
  readonly widgetType?: string;
}

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
  readonly pickerDraft: PickerDraft;
  readonly dirty: boolean;
  /**
   * Live mirror of `config.glyphs`. The `g` keybinding toggles between
   * `"off"` and `"nerd-font"`; the editor preview reads this value (not
   * the loaded config's snapshot) so flipping the mode is reflected
   * immediately. `saveEditedConfig` writes it back so the disk config
   * tracks the editor.
   */
  readonly glyphs: GlyphMode;
  /**
   * Memento — snapshot of `lines` + `glyphs` at the last save (or at
   * initial load). `revert` restores from this snapshot, discarding any
   * unsaved edits. `mark-clean` refreshes it on successful save.
   */
  readonly lastSaved: EditorSnapshot;
}

export interface EditorSnapshot {
  readonly lines: readonly LineConfig[];
  readonly glyphs: GlyphMode;
}

export type EditorAction =
  // ── selection / widget movement ──────────────────────────────────────────
  | { readonly type: "move-cursor"; readonly dx?: number; readonly dy?: number }
  | { readonly type: "move-widget"; readonly dx?: number; readonly dy?: number }
  // ── structural edits ─────────────────────────────────────────────────────
  | { readonly type: "delete" }
  // ── widget option mutators (CLI / programmatic only) ─────────────────────
  | { readonly type: "set-option"; readonly key: string; readonly value: unknown }
  // ── top-level config toggles ─────────────────────────────────────────────
  | { readonly type: "toggle-glyphs" }
  // ── picker drill-down (add / replace) ────────────────────────────────────
  | { readonly type: "open-picker"; readonly intent: "add" | "replace" }
  | { readonly type: "pick-category"; readonly category: WidgetCategory }
  | { readonly type: "pick-widget"; readonly widgetType: string }
  | { readonly type: "pick-variant"; readonly variantId: string | null }
  | { readonly type: "picker-back" }
  | { readonly type: "close-picker" }
  // ── dirty bookkeeping ────────────────────────────────────────────────────
  | { readonly type: "mark-clean" }
  | { readonly type: "mark-dirty" }
  // ── memento (discard unsaved edits, restore last-saved snapshot) ─────────
  | { readonly type: "revert" };

const FORBIDDEN_OPTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Pad `lines` to exactly `MAX_LINES` empty-row entries so every grid slot is real. */
function padToMaxLines(lines: readonly LineConfig[]): readonly LineConfig[] {
  const trimmed = lines.slice(0, MAX_LINES).map((l) => ({ widgets: [...l.widgets] }));
  while (trimmed.length < MAX_LINES) trimmed.push({ widgets: [] });
  return trimmed;
}

export function initialState(lines: readonly LineConfig[], glyphs: GlyphMode = "off"): EditorState {
  const padded = padToMaxLines(lines);
  const first = padded[0]!;
  return Object.freeze<EditorState>({
    lines: padded,
    cursor: { line: 0, widget: first.widgets.length > 0 ? 0 : 0 },
    mode: "edit",
    pickerTarget: { kind: "insert", line: 0, index: 0 },
    pickerDraft: {},
    dirty: false,
    glyphs,
    lastSaved: { lines: padded, glyphs },
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
    case "toggle-glyphs":
      return {
        ...state,
        glyphs: state.glyphs === "nerd-font" ? "off" : "nerd-font",
        dirty: true,
      };
    case "open-picker":
      return openPicker(state, action.intent);
    case "pick-category":
      return pickCategory(state, action.category);
    case "pick-widget":
      return pickWidget(state, action.widgetType);
    case "pick-variant":
      return pickVariant(state, action.variantId);
    case "picker-back":
      return pickerBack(state);
    case "close-picker":
      return isPickerMode(state.mode) ? backToEdit(state) : state;
    case "mark-clean":
      // Refresh the memento on save so a subsequent `revert` returns
      // here, not to the original loaded config.
      return {
        ...state,
        dirty: false,
        lastSaved: { lines: state.lines, glyphs: state.glyphs },
      };
    case "mark-dirty":
      return state.dirty ? state : { ...state, dirty: true };
    case "revert":
      if (!state.dirty) return state;
      return {
        ...state,
        lines: state.lastSaved.lines,
        glyphs: state.lastSaved.glyphs,
        dirty: false,
        // Pull cursor back into bounds in case the discarded edits had
        // extended a row beyond what the snapshot contains.
        cursor: clampCursor(state.cursor, state.lastSaved.lines),
      };
  }
}

function clampCursor(cursor: EditorCursor, lines: readonly LineConfig[]): EditorCursor {
  const line = clamp(cursor.line, 0, Math.max(0, lines.length - 1));
  const count = lines[line]?.widgets.length ?? 0;
  return { line, widget: clamp(cursor.widget, 0, count) };
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
  if (state.cursor.widget >= line.widgets.length) return undefined;
  return line.widgets[state.cursor.widget];
}

export function isPickerMode(mode: EditorMode): boolean {
  return mode === "picker-group" || mode === "picker-widget" || mode === "picker-variant";
}

// ─── movement ───────────────────────────────────────────────────────────────

function moveCursor(state: EditorState, dx: number, dy: number): EditorState {
  if (state.mode !== "edit") return state;
  const line = clamp(state.cursor.line + dy, 0, state.lines.length - 1);
  const count = widgetCountAt(state, line);
  const maxCol = count; // inclusive — add-cell sits at column `count`
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

// ─── structural edits ───────────────────────────────────────────────────────

function deleteWidget(state: EditorState): EditorState {
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

// ─── picker drill-down ──────────────────────────────────────────────────────

function openPicker(state: EditorState, intent: "add" | "replace"): EditorState {
  const line = state.cursor.line;
  const widgetCount = widgetCountAt(state, line);
  const onAdd = state.cursor.widget >= widgetCount;
  // "replace" requires a real widget under the cursor — on the add-cell,
  // degrade gracefully to "insert".
  const effective: PickerTargetKind = intent === "replace" && !onAdd ? "replace" : "insert";
  // Insert *after* the cursor for `add` on a widget; *at* the cursor for the
  // add-cell (which already points at the row's end). Replace targets the
  // selected widget directly.
  const index =
    effective === "replace" ? state.cursor.widget : onAdd ? widgetCount : state.cursor.widget + 1;
  return {
    ...state,
    mode: "picker-group",
    pickerTarget: { kind: effective, line, index },
    pickerDraft: {},
  };
}

function pickCategory(state: EditorState, category: WidgetCategory): EditorState {
  if (state.mode !== "picker-group") return state;
  return {
    ...state,
    mode: "picker-widget",
    pickerDraft: { ...state.pickerDraft, category },
  };
}

function pickWidget(state: EditorState, widgetType: string): EditorState {
  // Allow `pickWidget` from either step — `picker-widget` is the in-category
  // path; `picker-group` is the flat-search path (App-side: typing in step 1
  // turns the group list into a global filtered list, and Enter commits the
  // highlighted result without an intermediate category step).
  if (state.mode !== "picker-widget" && state.mode !== "picker-group") return state;
  if (!widgetType) return backToEdit(state);
  const variants = widgetVariants(widgetType);
  if (variants.length === 0) {
    // Commit immediately with default options — no variant step to drill into.
    return commit(
      { ...state, pickerDraft: { ...state.pickerDraft, widgetType } },
      widgetType,
      undefined,
    );
  }
  return {
    ...state,
    mode: "picker-variant",
    pickerDraft: { ...state.pickerDraft, widgetType },
  };
}

function pickVariant(state: EditorState, variantId: string | null): EditorState {
  if (state.mode !== "picker-variant") return state;
  const widgetType = state.pickerDraft.widgetType;
  if (!widgetType) return backToEdit(state);
  if (variantId === null) {
    return commit(state, widgetType, undefined);
  }
  const variant = widgetVariants(widgetType).find((v) => v.id === variantId);
  if (!variant) return commit(state, widgetType, undefined);
  return commit(state, widgetType, variant.options);
}

function pickerBack(state: EditorState): EditorState {
  if (state.mode === "picker-variant") {
    // Route back to the step the user came from: `picker-widget` if they
    // drilled in via a category, `picker-group` if they picked from the
    // flat-search list (no category in the draft).
    const back: EditorMode = state.pickerDraft.category ? "picker-widget" : "picker-group";
    return {
      ...state,
      mode: back,
      pickerDraft: { ...state.pickerDraft, widgetType: undefined },
    };
  }
  if (state.mode === "picker-widget") {
    return {
      ...state,
      mode: "picker-group",
      pickerDraft: { ...state.pickerDraft, category: undefined },
    };
  }
  if (state.mode === "picker-group") {
    return backToEdit(state);
  }
  return state;
}

function backToEdit(state: EditorState): EditorState {
  return { ...state, mode: "edit", pickerDraft: {} };
}

function commitReplace(
  state: EditorState,
  targetLine: number,
  index: number,
  fresh: WidgetConfig,
): EditorState {
  return {
    ...state,
    lines: replaceLine(state.lines, targetLine, {
      widgets: replaceAt(lineAt(state, targetLine)!.widgets, index, fresh),
    }),
    cursor: { line: targetLine, widget: index },
    mode: "edit",
    pickerDraft: {},
    dirty: true,
  };
}

function commitInsert(
  state: EditorState,
  targetLine: number,
  index: number,
  fresh: WidgetConfig,
): EditorState {
  const line = lineAt(state, targetLine)!;
  const widgets = [...line.widgets.slice(0, index), fresh, ...line.widgets.slice(index)];
  return {
    ...state,
    lines: replaceLine(state.lines, targetLine, { widgets }),
    cursor: { line: targetLine, widget: index },
    mode: "edit",
    pickerDraft: {},
    dirty: true,
  };
}

/**
 * Land a chosen `widgetType` + optional variant-options patch into the
 * editor state. Branches on `pickerTarget.kind`:
 *   - `insert`  — splice a fresh `WidgetConfig` at `target.index`.
 *   - `replace` — swap the widget at `target.index`. Prior colour/style
 *                 overrides are dropped so a new widget doesn't inherit
 *                 the previous one's accidents.
 */
function commit(
  state: EditorState,
  widgetType: string,
  variantOptions: Readonly<Record<string, unknown>> | undefined,
): EditorState {
  const { line: targetLine, index, kind } = state.pickerTarget;
  const line = lineAt(state, targetLine);
  if (!line) return backToEdit(state);

  const fresh: WidgetConfig = variantOptions
    ? { type: widgetType, options: sanitiseOptions({ ...variantOptions }) }
    : { type: widgetType };

  if (kind === "replace") {
    return commitReplace(state, targetLine, index, fresh);
  }

  return commitInsert(state, targetLine, index, fresh);
}

function setOption(state: EditorState, key: string, value: unknown): EditorState {
  if (typeof key !== "string" || key.trim() === "" || FORBIDDEN_OPTION_KEYS.has(key)) return state;
  return mutateCurrent(state, (w) => ({ ...w, options: { ...(w.options ?? {}), [key]: value } }));
}

// ─── internals ──────────────────────────────────────────────────────────────

function mutateCurrent(state: EditorState, fn: (w: WidgetConfig) => WidgetConfig): EditorState {
  const line = currentLine(state);
  if (!line || state.cursor.widget >= line.widgets.length) return state;
  const target = line.widgets[state.cursor.widget];
  if (!target) return state;
  const next = fn(target);
  if (next === target) return state;
  const widgets = replaceAt(line.widgets, state.cursor.widget, next);
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

function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}

function sanitiseOptions(opts: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    if (FORBIDDEN_OPTION_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function clamp(value: number, low: number, high: number): number {
  if (high < low) return low;
  if (value < low) return low;
  if (value > high) return high;
  return value;
}
