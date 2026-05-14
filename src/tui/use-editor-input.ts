/**
 * The TUI editor's input-handling hook.
 *
 * Owns per-step transient state (`stepQuery`, `stepHighlight`) and the
 * four mode-specific keypress handlers. Returns the transient state so
 * the editor's JSX can render the picker overlays with the same
 * `query`/`highlight` values the handlers are operating on.
 *
 * Decoupled from the JSX tree so `App` becomes a thin composition shell
 * of state init, `onSave`, the hook call, and the render tree — the
 * smell-report's critical-1 finding (the 149-line nested `useInput`)
 * landed here in PR #109; this hook is where the further extraction
 * for the H1 god-function lives.
 */

import type { Key as KeyEvent } from "ink";
import { useApp, useInput } from "ink";
import { useCallback, useEffect, useState, type Dispatch } from "react";

import { isErr, tryAsync } from "../lib/result.js";
import type { WidgetMetaEntry } from "../widgets/index.js";

import {
  categoriesWithWidgets,
  clampIndex,
  filterWidgets,
  selectedAt,
  variantRows,
  widgetsInCategory,
} from "./picker.js";
import type { SaveTracker } from "./mount.js";
import { isAddCell, type EditorAction, type EditorState } from "./state.js";

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

  // Per-step transient UI state — reset on every mode change so each step
  // starts with a clean filter and the highlight at row 0.
  const [stepQuery, setStepQuery] = useState("");
  const [stepHighlight, setStepHighlight] = useState(0);

  // Reset per-step state on every transition.
  useEffect(() => {
    setStepQuery("");
    setStepHighlight(0);
  }, [state.mode, state.pickerDraft.category, state.pickerDraft.widgetType]);

  // Each picker step has its own handler; each returns true if it
  // consumed the keypress so `useInput` can short-circuit. The edit
  // scope is the final fall-through.
  const handlePickerGroup = useCallback(
    (input: string, key: KeyEvent): boolean => {
      // Step 1 hosts a search field on top of the group list:
      //   - empty query  → ↑↓/↵ navigate and select a category;
      //   - typed query  → the group view collapses into a flat global
      //                    widget list filtered by substring; ↑↓/↵ act
      //                    on that list and Enter commits the widget
      //                    directly. Backspace through the query
      //                    returns the user to the group view.
      const searching = stepQuery.length > 0;
      if (key.escape) {
        dispatch({ type: "picker-back" });
        return true;
      }
      if (key.backspace || key.delete) {
        if (stepQuery.length === 0) return true;
        setStepQuery((q) => q.slice(0, -1));
        setStepHighlight(0);
        return true;
      }
      if (searching) {
        const matches = filterWidgets(widgetEntries, stepQuery, usedTypes);
        if (key.return) {
          const picked = selectedAt(matches, stepHighlight);
          if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
          return true;
        }
        if (key.upArrow) {
          setStepHighlight((h) => clampIndex(h - 1, matches.length));
          return true;
        }
        if (key.downArrow) {
          setStepHighlight((h) => clampIndex(h + 1, matches.length));
          return true;
        }
      } else {
        const cats = categoriesWithWidgets(widgetEntries, usedTypes);
        if (key.return) {
          const cat = selectedAt(cats, stepHighlight);
          if (cat) dispatch({ type: "pick-category", category: cat });
          return true;
        }
        if (key.upArrow) {
          setStepHighlight((h) => clampIndex(h - 1, cats.length));
          return true;
        }
        if (key.downArrow) {
          setStepHighlight((h) => clampIndex(h + 1, cats.length));
          return true;
        }
      }
      // Any printable key extends the search query and flips the view
      // to flat results on the next render.
      if (input.length === 1 && input >= " " && !key.ctrl && !key.meta) {
        setStepQuery((q) => q + input);
        setStepHighlight(0);
        return true;
      }
      return true;
    },
    [dispatch, stepQuery, stepHighlight, widgetEntries, usedTypes],
  );

  const handlePickerWidget = useCallback(
    (input: string, key: KeyEvent): boolean => {
      const category = state.pickerDraft.category;
      if (!category) {
        // Should never happen — defensive fall-through.
        dispatch({ type: "picker-back" });
        return true;
      }
      if (key.escape) {
        dispatch({ type: "picker-back" });
        return true;
      }
      if (key.return) {
        const matches = widgetsInCategory(widgetEntries, category, stepQuery, usedTypes);
        const picked = selectedAt(matches, stepHighlight);
        if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
        return true;
      }
      if (key.upArrow) {
        const matches = widgetsInCategory(widgetEntries, category, stepQuery, usedTypes);
        setStepHighlight((h) => clampIndex(h - 1, matches.length));
        return true;
      }
      if (key.downArrow) {
        const matches = widgetsInCategory(widgetEntries, category, stepQuery, usedTypes);
        setStepHighlight((h) => clampIndex(h + 1, matches.length));
        return true;
      }
      if (key.backspace || key.delete) {
        setStepQuery((q) => q.slice(0, -1));
        setStepHighlight(0);
        return true;
      }
      if (input.length === 1 && input >= " " && !key.ctrl && !key.meta) {
        setStepQuery((q) => q + input);
        setStepHighlight(0);
        return true;
      }
      return true;
    },
    [dispatch, state.pickerDraft.category, stepQuery, stepHighlight, widgetEntries, usedTypes],
  );

  const handlePickerVariant = useCallback(
    (_input: string, key: KeyEvent): boolean => {
      const widgetType = state.pickerDraft.widgetType;
      if (!widgetType) {
        dispatch({ type: "picker-back" });
        return true;
      }
      const rows = variantRows(widgetType, "fresh");
      if (key.escape) {
        dispatch({ type: "picker-back" });
        return true;
      }
      if (key.return) {
        const row = selectedAt(rows, stepHighlight);
        if (row) dispatch({ type: "pick-variant", variantId: row.id });
        return true;
      }
      if (key.upArrow) {
        setStepHighlight((h) => clampIndex(h - 1, rows.length));
        return true;
      }
      if (key.downArrow) {
        setStepHighlight((h) => clampIndex(h + 1, rows.length));
        return true;
      }
      return true;
    },
    [dispatch, state.pickerDraft.widgetType, stepHighlight],
  );

  const handleEdit = useCallback(
    (input: string, key: KeyEvent): void => {
      if (key.escape || input === "q") {
        onSaved(false);
        exit();
        return;
      }
      if (input === "s" || input === "S" || (key.ctrl && input === "s")) {
        if (saveTracker.inFlight) return;
        // Defense-in-depth: `onSave` catches its own errors today, but
        // `void` would silently swallow any rejection that ever leaked
        // through. Surface it in the status line instead.
        tryAsync(onSave).then((r) => {
          if (isErr(r)) setStatusMessage(`save failed: ${r.error.message}`);
        });
        return;
      }
      if (key.leftArrow) {
        dispatch(key.shift ? { type: "move-widget", dx: -1 } : { type: "move-cursor", dx: -1 });
        return;
      }
      if (key.rightArrow) {
        dispatch(key.shift ? { type: "move-widget", dx: 1 } : { type: "move-cursor", dx: 1 });
        return;
      }
      if (key.upArrow) {
        dispatch(key.shift ? { type: "move-widget", dy: -1 } : { type: "move-cursor", dy: -1 });
        return;
      }
      if (key.downArrow) {
        dispatch(key.shift ? { type: "move-widget", dy: 1 } : { type: "move-cursor", dy: 1 });
        return;
      }
      if (key.return) {
        if (isAddCell(state)) dispatch({ type: "open-picker", intent: "add" });
        // On a populated widget ↵ is a no-op now — `u`/`r` cover the
        // edit paths the options sheet used to surface.
        return;
      }
      if (input === "a") return dispatch({ type: "open-picker", intent: "add" });
      if (input === "r") return dispatch({ type: "open-picker", intent: "replace" });
      if (input === "d" || input === "x" || key.delete || key.backspace) {
        dispatch({ type: "delete" });
        return;
      }
      if (input === "g") {
        const next = state.glyphs === "nerd-font" ? "off" : "nerd-font";
        // When `agentline install` couldn't find a Nerd Font, lock the
        // toggle to "off" — enabling glyphs would only paint tofu boxes
        // onto the rendered statusline. Toggling *off* is still allowed
        // so a user who edited the file by hand can recover via the UI.
        if (!nerdFontAvailable && next === "nerd-font") {
          setStatusMessage(
            "glyphs: disabled — install a Nerd Font, then re-run `agentline install`",
          );
          return;
        }
        dispatch({ type: "toggle-glyphs" });
        // Surface the new value so the user can see the toggle landed
        // even if their terminal lacks a Nerd Font.
        setStatusMessage(`glyphs: ${next}`);
        return;
      }
    },
    [dispatch, exit, nerdFontAvailable, onSave, onSaved, saveTracker, setStatusMessage, state],
  );

  useInput((input, key) => {
    switch (state.mode) {
      case "picker-group":
        handlePickerGroup(input, key);
        return;
      case "picker-widget":
        handlePickerWidget(input, key);
        return;
      case "picker-variant":
        handlePickerVariant(input, key);
        return;
      case "edit":
        handleEdit(input, key);
        return;
    }
  });

  return { stepQuery, stepHighlight };
}
