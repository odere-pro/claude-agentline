/**
 * The TUI editor's input-handling hook.
 *
 * Owns per-step transient state (`stepQuery`, `stepHighlight`) and forwards
 * `useInput` to one of five pure handlers in `editor-input-handlers.ts`.
 * Returns the transient state so the editor's JSX can render the picker
 * overlays with the same `query`/`highlight` values the handlers are
 * operating on.
 *
 * Decoupled from the JSX tree so `App` becomes a thin composition shell
 * of state init, `onSave`, the hook call, and the render tree.
 */

import { useApp, useInput } from "ink";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { WidgetMetaEntry } from "../../widgets/index.js";

import {
  handleEditKey,
  handlePickerGroupKey,
  handlePickerSearchKey,
  handlePickerVariantKey,
  handlePickerWidgetKey,
  type EditHandlerDeps,
} from "./editor-input-handlers.js";
import type { SaveTracker } from "./mount.js";
import type { EditorAction, EditorMode, EditorState } from "./state.js";

export interface UseEditorInputOptions {
  readonly state: EditorState;
  readonly dispatch: Dispatch<EditorAction>;
  readonly saveTracker: SaveTracker;
  /** The editor's async save trigger. Re-entrant; returns the in-flight promise. */
  readonly onSave: () => Promise<void>;
  /** Notify the host (`runConfigCommand`) that the session exited with `saved=false`. */
  readonly onSaved: (saved: boolean) => void;
  /** Surface a transient banner above the footer (e.g. save errors). */
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
    setStatusMessage,
    widgetEntries,
    usedTypes,
  } = opts;
  const { exit } = useApp();

  /*
   * Per-step transient UI state. The `stepQuery` is shared across the
   * picker steps (search field on top); the highlight is stored *per
   * mode* so backing out of a sub-step (Esc from `picker-widget` →
   * `picker-group`) restores the previously focused row instead of
   * snapping back to index 0.
   */
  const [stepQuery, setStepQuery] = useState("");
  const [highlights, setHighlights] = useState<Record<EditorMode, number>>({
    edit: 0,
    "picker-group": 0,
    "picker-widget": 0,
    "picker-search": 0,
    "picker-variant": 0,
  });
  const stepHighlight = highlights[state.mode] ?? 0;
  const setStepHighlight: Dispatch<SetStateAction<number>> = (next) => {
    setHighlights((h) => {
      const prev = h[state.mode] ?? 0;
      const value = typeof next === "function" ? (next as (p: number) => number)(prev) : next;
      return { ...h, [state.mode]: value };
    });
  };

  /*
   * `pickerDraft` exists only on the picker branch of the discriminated
   * union. Derive nullable views so the dependency arrays stay accessible
   * without re-narrowing each time.
   */
  const pickerFamily = state.mode === "edit" ? undefined : state.pickerDraft.family;
  const pickerWidgetType = state.mode === "edit" ? undefined : state.pickerDraft.widgetType;

  /*
   * Reset on *forward* transitions only. Going `picker-group` →
   * `picker-widget` (a new sub-list under a different family) or
   * `picker-widget` → `picker-variant` re-starts the highlight at the
   * top of the new list. Backing out (`picker-widget` → `picker-group`)
   * keeps each step's stored highlight so the user returns to where
   * they were. Closing the picker (`* → edit`) clears everything so the
   * next reopen starts cleanly.
   */
  const prevMode = useRef<EditorMode>(state.mode);
  useEffect(() => {
    const was = prevMode.current;
    const is = state.mode;
    if (was === is) return;
    const forward =
      (was === "picker-group" &&
        (is === "picker-widget" || is === "picker-search" || is === "picker-variant")) ||
      (was === "picker-widget" && is === "picker-variant") ||
      (was === "picker-search" && is === "picker-variant") ||
      (was === "edit" && is !== "edit");
    if (is === "edit") {
      setStepQuery("");
      setHighlights({
        edit: 0,
        "picker-group": 0,
        "picker-widget": 0,
        "picker-search": 0,
        "picker-variant": 0,
      });
    } else if (forward) {
      setStepQuery("");
      setHighlights((h) => ({ ...h, [is]: 0 }));
    }
    prevMode.current = is;
  }, [state.mode]);

  /*
   * When the active family or widget type changes underneath the user
   * (they pick a different family from the flat-search list, or replace
   * the widget mid-flow), the list contents change too — start at the
   * top of the new list.
   */
  useEffect(() => {
    setStepQuery("");
    setHighlights((h) => ({ ...h, "picker-widget": 0 }));
  }, [pickerFamily]);
  useEffect(() => {
    setStepQuery("");
    setHighlights((h) => ({ ...h, "picker-variant": 0 }));
  }, [pickerWidgetType]);

  useInput((input, key) => {
    /*
     * Clear the transient status banner on every keystroke — the "saved
     * → …" / "save failed: …" / "glyphs: …" lines are short-lived
     * notifications, and leaving them on screen while the user navigates
     * or reopens the picker looks like stale config grift. Handlers that
     * set a fresh banner during this same callback (glyph toggle, save
     * failure) overwrite the empty string before the next render.
     */
    setStatusMessage("");
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
      setStatusMessage,
    };
    switch (state.mode) {
      case "picker-group":
        handlePickerGroupKey(input, key, deps);
        return;
      case "picker-widget":
        handlePickerWidgetKey(input, key, deps);
        return;
      case "picker-search":
        handlePickerSearchKey(input, key, deps);
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
