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
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { AgentlineConfig } from "../../data/config/types.js";
import { createTranslator, widgetNameId, type Translator } from "../../core/i18n/index.js";
import { listBindings } from "../keys/index.js";
import type { Theme } from "../../data/theme/index.js";
import { widgetMeta, widgetVariants } from "../../widgets/catalog.js";
import { defaultRegistry, registerAllBuiltins, type WidgetMetaEntry } from "../../widgets/index.js";

import { footerLines } from "./footer.js";
import type { EditorGlyphs } from "./glyphs.js";
import type { SaveTracker } from "./mount.js";
import { saveEditedConfig, triggerBackgroundRerender } from "./persist.js";
import { PickerGroup, PickerSearch, PickerVariant, PickerWidget } from "./picker.js";
import { Preview } from "./preview.js";
import { currentWidget, initialState, reduce } from "./state.js";
import { useEditorInput } from "./use-editor-input.js";
import { useTerminalWidth } from "./use-terminal-width.js";

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
  /**
   * Resolved process env. Forwarded to the preview/picker so family
   * identity (glyph degradation) resolves through the same inputs the
   * live statusline render uses.
   */
  readonly env: NodeJS.ProcessEnv;
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
function selectedWidgetLabel(type: string, t: Translator): string {
  const meta = widgetMeta(type);
  return meta ? `${t(widgetNameId(type), meta.name)} (${type})` : type;
}

export function App({
  initialConfig,
  path,
  previewTheme,
  glyphs,
  env,
  onSaved,
  saveTracker,
}: AppProps): React.ReactElement {
  const [state, dispatch] = useReducer(reduce, initialConfig, (cfg) => initialState(cfg.lines));
  const [statusMessage, setStatusMessage] = useState<string>("");
  /*
   * Live terminal width. Re-renders on resize so the preview's bordered
   * box and wrap threshold track the terminal — Ink's own resize path
   * only re-lays-out Yoga, it doesn't re-run this component.
   */
  const columns = useTerminalWidth();
  const bindings = useMemo(
    () => listBindings(initialConfig.keymap as Record<string, string> | undefined),
    [initialConfig.keymap],
  );
  const widgetEntries = useMemo(() => builtinWidgetEntries(), []);
  const t = useMemo(() => createTranslator(initialConfig), [initialConfig]);

  /*
   * `onSave` runs as a detached async body. If the user presses `q`/Esc
   * mid-save, the host (`mountEditor`) reads `savedRef.value` from the
   * `onSaved` prop as soon as Ink unmounts; a late `onSaved(true)` after
   * unmount would write past that read and the caller would see a stale
   * value. The ref tracks mount state so the save body can skip both the
   * React state setters (already silent no-ops on unmount) and the
   * `onSaved` callback once the editor is gone.
   */
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

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
      if (target && widgetVariants(target.type).length > 0) {
        set.delete(target.type);
      }
    }
    return set;
  }, [state]);

  /*
   * The resolved render basis shared by every picker view — the same
   * `{ config, theme, env }` the live statusline and the editor preview
   * render through, so picker chrome and previews match `agentline
   * render` exactly (incl. custom themes and `config.families`).
   */
  const pickerBasis = useMemo(
    () => ({ config: initialConfig, theme: previewTheme, env }),
    [initialConfig, previewTheme, env],
  );

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
    /*
     * Publish the in-flight promise to the tracker BEFORE the worker
     * starts so a concurrent reader (SIGTERM handler, second `s`
     * keypress) cannot observe `null` while the save is running. The
     * deferred-resolver pattern lets the tracker assignment happen
     * synchronously before any await; the IIFE below settles the
     * deferred via the surrounding `try / finally`.
     */
    let resolveSave!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    saveTracker.inFlight = promise;
    void (async () => {
      try {
        const savedConfig = await saveEditedConfig({
          path,
          base: initialConfig,
          lines: state.lines,
        });
        void triggerBackgroundRerender(savedConfig);
        if (mountedRef.current) {
          dispatch({ type: "mark-clean" });
          setStatusMessage(
            t(
              "app.saved",
              `saved → {path} — preview updated · will render on your next Claude Code prompt`,
              { path },
            ),
          );
          onSaved(true);
        }
      } catch (err) {
        if (mountedRef.current) {
          setStatusMessage(
            t("app.save-failed", "save failed: {message}", {
              message: (err as Error).message,
            }),
          );
        }
      } finally {
        if (saveTracker.inFlight === promise) saveTracker.inFlight = null;
        resolveSave();
      }
    })();
    return promise;
  }, [initialConfig, onSaved, path, state.lines, saveTracker, t]);

  const { stepQuery, stepHighlight } = useEditorInput({
    state,
    dispatch,
    saveTracker,
    onSave,
    onSaved,
    setStatusMessage,
    widgetEntries,
    usedTypes,
  });

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true }, t("app.title", "agentline edit")),
    React.createElement(Text, { dimColor: true }, t("app.editing", "editing {path}", { path })),
    (() => {
      const widget = currentWidget(state);
      const label = widget
        ? selectedWidgetLabel(widget.type, t)
        : t("app.no-widget", "(+ add widget)");
      return React.createElement(
        Text,
        { color: "cyan" },
        t("app.selected", "selected: {label}", { label }),
      );
    })(),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Preview, {
        base: initialConfig,
        lines: state.lines,
        cursor: state.cursor,
        theme: previewTheme,
        glyphs,
        env,
        columns,
      }),
    ),
    (() => {
      const lines = footerLines(bindings, state.mode, t);
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
          t("app.unsaved", " ● unsaved changes — press s to save, q/Esc to discard "),
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
            t,
            ...pickerBasis,
          })
        : React.createElement(PickerGroup, {
            entries: widgetEntries,
            highlight: stepHighlight,
            glyphs,
            exclude: usedTypes,
            t,
            ...pickerBasis,
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
        t,
        ...pickerBasis,
      });
    })(),
    state.mode === "picker-search"
      ? React.createElement(PickerSearch, {
          entries: widgetEntries,
          query: stepQuery,
          highlight: stepHighlight,
          exclude: usedTypes,
          t,
          ...pickerBasis,
        })
      : null,
    state.mode === "picker-variant" && state.pickerDraft.widgetType
      ? React.createElement(PickerVariant, {
          widgetType: state.pickerDraft.widgetType,
          mode: "fresh",
          highlight: stepHighlight,
          t,
          ...pickerBasis,
        })
      : null,
  );
}
