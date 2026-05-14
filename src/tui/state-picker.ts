/**
 * Picker drill-down + commit transitions for the TUI reducer.
 *
 * `openPicker` is the only transition from `EditorEditState` to
 * `EditorPickerState`; the other helpers walk between picker steps or
 * commit back to edit mode (`backToEdit`, `commit`). All commits drop
 * `pickerTarget` / `pickerDraft` so the returned `EditorEditState`
 * doesn't carry stale picker-only fields — illegal-state representation
 * is prevented at the type level by the discriminated union in
 * `state.ts`.
 */

import type { WidgetConfig } from "../config/types.js";
import { widgetVariants, type WidgetCategory } from "../widgets/catalog.js";

import {
  FORBIDDEN_OPTION_KEYS,
  lineAt,
  replaceAt,
  replaceLine,
  widgetCountAt,
  type EditorEditState,
  type EditorMode,
  type EditorPickerState,
  type EditorState,
  type PickerTargetKind,
} from "./state.js";

export function openPicker(
  state: EditorState,
  intent: "add" | "replace",
): EditorPickerState | EditorState {
  if (state.mode !== "edit") return state;
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

export function pickCategory(state: EditorState, category: WidgetCategory): EditorState {
  if (state.mode !== "picker-group") return state;
  return {
    ...state,
    mode: "picker-widget",
    pickerDraft: { ...state.pickerDraft, category },
  };
}

export function pickWidget(state: EditorState, widgetType: string): EditorState {
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

export function pickVariant(state: EditorState, variantId: string | null): EditorState {
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

export function pickerBack(state: EditorState): EditorState {
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

export function backToEdit(state: EditorPickerState): EditorEditState {
  // Strip picker-only fields so the returned state matches `EditorEditState`
  // — the discriminated union prevents picker code from accidentally
  // reading them after commit.
  const { pickerTarget: _pickerTarget, pickerDraft: _pickerDraft, ...base } = state;
  return { ...base, mode: "edit" };
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
  state: EditorPickerState,
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

function commitReplace(
  state: EditorPickerState,
  targetLine: number,
  index: number,
  fresh: WidgetConfig,
): EditorEditState {
  const base = backToEdit(state);
  return {
    ...base,
    lines: replaceLine(base.lines, targetLine, {
      widgets: replaceAt(lineAt(state, targetLine)!.widgets, index, fresh),
    }),
    cursor: { line: targetLine, widget: index },
    dirty: true,
  };
}

function commitInsert(
  state: EditorPickerState,
  targetLine: number,
  index: number,
  fresh: WidgetConfig,
): EditorEditState {
  const line = lineAt(state, targetLine)!;
  const widgets = [...line.widgets.slice(0, index), fresh, ...line.widgets.slice(index)];
  const base = backToEdit(state);
  return {
    ...base,
    lines: replaceLine(base.lines, targetLine, { widgets }),
    cursor: { line: targetLine, widget: index },
    dirty: true,
  };
}

function sanitiseOptions(opts: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    if (FORBIDDEN_OPTION_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}
