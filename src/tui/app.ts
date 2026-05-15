/**
 * Ink-based root component for the TUI editor.
 *
 * Composition shell — installs the input hook (`useEditorInput`),
 * orchestrates the async save flow, and projects the editor state +
 * `stepQuery` / `stepHighlight` into the JSX tree (preview, footer,
 * picker overlay). The save lifecycle lives here so the `onSave`
 * callback closes over `saveEditedConfig` and dispatches `mark-clean`
 * on success; everything else is delegated.
 *
 * Loaded only via the dynamic `import("./tui.mjs")` from cli.mjs;
 * never reaches the render path.
 */

import { Box, Text } from "ink";
import React, { useCallback, useMemo, useReducer, useState } from "react";

import type { AgentlineConfig } from "../config/types.js";
import { listBindings } from "../keys/index.js";
import type { Theme } from "../theme/index.js";
import { widgetMeta, widgetVariants } from "../widgets/catalog.js";
import { defaultRegistry, registerAllBuiltins, type WidgetMetaEntry } from "../widgets/index.js";

import { footerLines } from "./footer.js";
import type { EditorGlyphs } from "./glyphs.js";
import type { SaveTracker } from "./mount.js";
import { saveEditedConfig } from "./persist.js";
import { PickerGroup, PickerSearch, PickerVariant, PickerWidget } from "./picker.js";
import { Preview } from "./preview.js";
import { currentWidget, initialState, reduce } from "./state.js";
import { useEditorInput } from "./use-editor-input.js";

export interface RunConfigInput {
  readonly env?: NodeJS.ProcessEnv;
  /** Directly pre-supplied config; primarily used by smoke tests. */
  readonly preloaded?: { config: AgentlineConfig; path: string };
  /** Cwd the project-gate probes. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Stdin override for the project-gate prompt; tests inject a PassThrough. */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
}

export interface RunConfigResult {
  readonly saved: boolean;
  readonly path: string;
  /** `true` when the project gate caused an early skip; preloaded path is empty. */
  readonly skipped?: boolean;
}

export interface AppProps {
  readonly initialConfig: AgentlineConfig;
  readonly path: string;
  readonly previewTheme: Theme | null;
  readonly glyphs: EditorGlyphs;
  /** `false` when the install probe didn't find a Nerd Font; locks the `g` toggle to "off". */
  readonly nerdFontAvailable: boolean;
  readonly onSaved: (saved: boolean) => void;
  /**
   * Shared in-flight save tracker. The signal handler in `enterAltScreen`
   * reads from the same object so SIGTERM mid-save waits for the atomic
   * write to finish before exiting.
   */
  readonly saveTracker: SaveTracker;
}

/** The catalogued built-in widgets, populating the default registry once. */
function builtinWidgetEntries(): readonly WidgetMetaEntry[] {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry.listMeta();
}

/** Human-readable label for the currently selected widget (catalogue name + type). */
function selectedWidgetLabel(type: string): string {
  const meta = widgetMeta(type);
  return meta ? `${meta.name} (${type})` : type;
}

export function App({
  initialConfig,
  path,
  previewTheme,
  glyphs,
  nerdFontAvailable,
  onSaved,
  saveTracker,
}: AppProps): React.ReactElement {
  const [state, dispatch] = useReducer(reduce, initialConfig, (cfg) =>
    initialState(cfg.lines, nerdFontAvailable ? cfg.glyphs : "off"),
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const bindings = useMemo(
    () => listBindings(initialConfig.keymap as Record<string, string> | undefined),
    [initialConfig.keymap],
  );
  const widgetEntries = useMemo(() => builtinWidgetEntries(), []);

  /*
   * Types already placed in the layout. The picker hides these so the user
   * can't add the same widget twice. In replace mode the widget under the
   * cursor is on its way out — but we only let its type back into the
   * picker when the widget has variants, so users on a variant-bearing
   * widget can still swap variants via replace. For variant-less widgets,
   * re-picking the same type would be a no-op and is excluded.
   */
  const usedTypes = useMemo(() => {
    const set = new Set<string>();
    for (const line of state.lines) for (const w of line.widgets) set.add(w.type);
    /*
     * `state.pickerTarget` exists only on the picker branch of the
     * discriminated union; the mode-check narrows it for TS.
     */
    if (state.mode !== "edit" && state.pickerTarget.kind === "replace") {
      const line = state.lines[state.pickerTarget.line];
      const target = line?.widgets[state.pickerTarget.index];
      if (target && widgetVariants(target.type).length > 0) set.delete(target.type);
    }
    return set;
  }, [state]);

  const onSave = useCallback(async (): Promise<void> => {
    /*
     * Re-entry guard: a second `s` keypress during an in-flight save
     * returns the existing promise so callers can still await
     * completion. The previous boolean ref worked because `useInput`
     * fires synchronously, but a Promise reference makes the contract
     * explicit and lets the SIGTERM handler in `enterAltScreen` await
     * the same value.
     */
    if (saveTracker.inFlight) return saveTracker.inFlight;
    const promise = (async () => {
      try {
        await saveEditedConfig({
          path,
          base: initialConfig,
          lines: state.lines,
          glyphs: state.glyphs,
        });
        dispatch({ type: "mark-clean" });
        setStatusMessage(
          `saved → ${path} — run "agentline start" to preview, or Restart Claude Code`,
        );
        onSaved(true);
      } catch (err) {
        setStatusMessage(`save failed: ${(err as Error).message}`);
      }
    })();
    saveTracker.inFlight = promise;
    void promise.finally(() => {
      if (saveTracker.inFlight === promise) saveTracker.inFlight = null;
    });
    return promise;
  }, [initialConfig, onSaved, path, state.lines, state.glyphs, saveTracker]);

  const { stepQuery, stepHighlight } = useEditorInput({
    state,
    dispatch,
    saveTracker,
    onSave,
    onSaved,
    nerdFontAvailable,
    setStatusMessage,
    widgetEntries,
    usedTypes,
  });

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true }, "agentline edit"),
    React.createElement(Text, { dimColor: true }, `editing ${path}`),
    (() => {
      const widget = currentWidget(state);
      const label = widget ? selectedWidgetLabel(widget.type) : "(+ add widget)";
      return React.createElement(Text, { color: "cyan" }, `selected: ${label}`);
    })(),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Preview, {
        /*
         * Synthesize an effective base that reflects the editor's live
         * glyph mode so toggling `g` is visible immediately. Everything
         * else — theme, global, powerline — comes from the loaded config.
         */
        base: { ...initialConfig, glyphs: state.glyphs },
        lines: state.lines,
        cursor: state.cursor,
        theme: previewTheme,
        glyphs,
      }),
    ),
    (() => {
      const lines = footerLines(bindings, state.mode);
      return React.createElement(
        Box,
        { flexDirection: "column", marginTop: 1 },
        lines.motion
          ? React.createElement(Text, { key: "motion", dimColor: true }, lines.motion)
          : null,
        lines.actions
          ? React.createElement(Text, { key: "actions", dimColor: true }, lines.actions)
          : null,
      );
    })(),
    state.dirty
      ? React.createElement(
          Text,
          { color: "yellow" },
          " ● unsaved changes — press s to save, q/Esc to discard ",
        )
      : null,
    statusMessage ? React.createElement(Text, { color: "green" }, ` ${statusMessage} `) : null,
    state.mode === "picker-group"
      ? stepQuery.length > 0
        ? React.createElement(PickerSearch, {
            entries: widgetEntries,
            query: stepQuery,
            highlight: stepHighlight,
            exclude: usedTypes,
          })
        : React.createElement(PickerGroup, {
            entries: widgetEntries,
            highlight: stepHighlight,
            glyphs,
            exclude: usedTypes,
          })
      : null,
    (() => {
      if (state.mode !== "picker-widget") return null;
      const family = state.pickerDraft.family;
      if (!family) return null;
      return React.createElement(PickerWidget, {
        family,
        entries: widgetEntries,
        query: stepQuery,
        highlight: stepHighlight,
        exclude: usedTypes,
      });
    })(),
    state.mode === "picker-variant" && state.pickerDraft.widgetType
      ? React.createElement(PickerVariant, {
          widgetType: state.pickerDraft.widgetType,
          mode: "fresh",
          highlight: stepHighlight,
        })
      : null,
  );
}
