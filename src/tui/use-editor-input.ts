/**
 * The TUI editor's input-handling hook.
 *
 * Owns per-step transient state (`stepQuery`, `stepHighlight`) and forwards
 * `useInput` to one of four pure handlers in `editor-input-handlers.ts`.
 * Returns the transient state so the editor's JSX can render the picker
 * overlays with the same `query`/`highlight` values the handlers are
 * operating on.
 *
 * Decoupled from the JSX tree so `App` becomes a thin composition shell
 * of state init, `onSave`, the hook call, and the render tree. The four
 * handler bodies used to live inline as `useCallback` closures over half
 * the editor state; PR #126 lifted them out per smell-report H-code-1.
 */

import { useApp, useInput } from "ink";
import { useEffect, useState, type Dispatch } from "react";

import type { WidgetMetaEntry } from "../widgets/index.js";

import {
  handleEditKey,
  handlePickerGroupKey,
  handlePickerVariantKey,
  handlePickerWidgetKey,
  type EditHandlerDeps,
} from "./editor-input-handlers.js";
import type { SaveTracker } from "./mount.js";
import type { EditorAction, EditorState } from "./state.js";

export interface UseEditorInputOptions {
  readonly state: EditorState;
  readonly dispatch: Dispatch<EditorAction>;
  readonly saveTracker: SaveTracker;
  /** The editor's async save trigger. Re-entrant; returns the in-flight promise. */
  readonly onSave: () => Promise<void>;
  /** Notify the host (`runConfigCommand`) that the session exited with `saved=false`. */
  readonly onSaved: (saved: boolean) => void;
  /** `false` when the install probe didn't find a Nerd Font; locks the `g` toggle to "off". */
  readonly nerdFontAvailable: boolean;
  /** Surface a transient banner above the footer (save errors, glyph-toggle confirmations). */
  readonly setStatusMessage: (message: string) => void;
  readonly widgetEntries: readonly WidgetMetaEntry[];
  readonly usedTypes: ReadonlySet<string>;
}

export interface UseEditorInputResult {
  /** Search field text shared across the picker steps. */
  readonly stepQuery: string;
  /** Cursor row inside the current picker list. */
  readonly stepHighlight: number;
}

export function useEditorInput(opts: UseEditorInputOptions): UseEditorInputResult {
  const {
    state,
    dispatch,
    saveTracker,
    onSave,
    onSaved,
    nerdFontAvailable,
    setStatusMessage,
    widgetEntries,
    usedTypes,
  } = opts;
  const { exit } = useApp();

  // Per-step transient UI state — reset on every mode change so each
  // step starts with a clean filter and the highlight at row 0.
  const [stepQuery, setStepQuery] = useState("");
  const [stepHighlight, setStepHighlight] = useState(0);

  // `pickerDraft` exists only on the picker branch of the discriminated
  // union. Derive nullable views so the dependency arrays stay accessible
  // without re-narrowing each time.
  const pickerCategory = state.mode === "edit" ? undefined : state.pickerDraft.category;
  const pickerWidgetType = state.mode === "edit" ? undefined : state.pickerDraft.widgetType;

  useEffect(() => {
    setStepQuery("");
    setStepHighlight(0);
  }, [state.mode, pickerCategory, pickerWidgetType]);

  useInput((input, key) => {
    const deps: EditHandlerDeps = {
      state,
      dispatch,
      widgetEntries,
      usedTypes,
      stepQuery,
      stepHighlight,
      setStepQuery,
      setStepHighlight,
      exit,
      onSave,
      onSaved,
      saveTracker,
      nerdFontAvailable,
      setStatusMessage,
    };
    switch (state.mode) {
      case "picker-group":
        handlePickerGroupKey(input, key, deps);
        return;
      case "picker-widget":
        handlePickerWidgetKey(input, key, deps);
        return;
      case "picker-variant":
        handlePickerVariantKey(input, key, deps);
        return;
      case "edit":
        handleEditKey(input, key, deps);
        return;
    }
  });

  return { stepQuery, stepHighlight };
}
