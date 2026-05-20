/**
 * Ink-based root component for the TUI editor.
 *
 * Composition shell — installs the input hook (`useEditorInput`),
 * orchestrates the async save flow (`useSaveFlow`), reads the
 * derivational memos (`useEditorBindings`), and projects the editor
 * state + `stepQuery` / `stepHighlight` into the JSX tree (preview,
 * footer, picker overlays). The save lifecycle and all derived memos
 * live in their own hook files; this module is the thin JSX shell.
 *
 * Loaded only via the dynamic `import("./tui.mjs")` from cli.mjs;
 * never reaches the render path.
 */

import { Box, Text } from "ink";
import React, { useCallback, useReducer } from "react";

import type { AgentlineConfig } from "../../data/config/types.js";
import { widgetNameId, type Translator } from "../../core/i18n/index.js";
import type { Theme } from "../../data/theme/index.js";
import { widgetMeta } from "../../widgets/families/catalog.js";

import { footerLines } from "./footer.js";
import type { EditorGlyphs } from "./glyphs/glyphs.js";
import type { SaveTracker } from "./mount.js";
import { PickerGroup, PickerSearch, PickerVariant, PickerWidget } from "../picker/picker.js";
import { Preview } from "../preview/preview.js";
import { currentWidget, initialState, reduce } from "../state/state.js";
import { useEditorBindings } from "./use/use-editor-bindings.js";
import { useEditorInput } from "./use/use-editor-input.js";
import { useSaveFlow } from "./use/use-save-flow.js";
import { useTerminalWidth } from "./use/use-terminal-width.js";

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
  /*
   * Live terminal width. Re-renders on resize so the preview's bordered
   * box and wrap threshold track the terminal — Ink's own resize path
   * only re-lays-out Yoga, it doesn't re-run this component.
   */
  const columns = useTerminalWidth();

  const { bindings, widgetEntries, t, td, usedTypes, pickerBasis } = useEditorBindings({
    initialConfig,
    previewTheme,
    env,
    state,
  });

  const markClean = useCallback(() => dispatch({ type: "mark-clean" }), []);
  const { onSave, statusMessage, setStatusMessage } = useSaveFlow({
    initialConfig,
    path,
    lines: state.lines,
    saveTracker,
    onSaved,
    markClean,
    t: td,
  });

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
    React.createElement(Text, { bold: true }, td("app.title")),
    React.createElement(Text, { dimColor: true }, td("app.editing", { path })),
    (() => {
      const widget = currentWidget(state);
      const label = widget ? selectedWidgetLabel(widget.type, t) : td("app.no-widget");
      return React.createElement(Text, { color: "cyan" }, td("app.selected", { label }));
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
      ? React.createElement(Text, { color: "yellow" }, td("app.unsaved"))
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
            td,
            ...pickerBasis,
          })
        : React.createElement(PickerGroup, {
            entries: widgetEntries,
            highlight: stepHighlight,
            glyphs,
            exclude: usedTypes,
            t,
            td,
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
        td,
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
          td,
          ...pickerBasis,
        })
      : null,
  );
}
