/**
 * Ink-based TUI editor entry (`agentline config` — §1.1 F10, §5.5).
 *
 * This module is loaded ONLY by a dynamic `import("./tui.mjs")` from
 * cli.mjs. tsup builds it as a separate output file so Ink + React never
 * appear in the render-path bundle (§1.2 N3).
 *
 * The renderer is intentionally thin: it observes the pure state machine
 * in `state.ts`, dispatches `EditorAction`s on key input, and writes the
 * merged config to disk via `saveEditedConfig`. The live preview
 * (`./preview.ts`) is the editing surface — there is no separate
 * "layout list" view; the cursor moves through the rendered statusline
 * itself, with each row ending in a navigable "+ add widget" cell.
 */

import { Box, Text, render, useApp, useInput } from "ink";
import React, { useCallback, useMemo, useReducer, useState } from "react";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { loadConfig } from "../config/load.js";
import { resolveConfigPaths } from "../config/paths.js";
import type { AgentlineConfig } from "../config/types.js";
import { listBindings, type KeyBinding } from "../keys/index.js";
import { resolveEnv } from "../lib/env.js";
import type { Theme } from "../theme/index.js";
import { resolveConfiguredTheme } from "../theme/resolve.js";

import { defaultRegistry, registerAllBuiltins, type WidgetMetaEntry } from "../widgets/index.js";

import { pickGlyphs, type EditorGlyphs } from "./glyphs.js";
import { saveEditedConfig } from "./persist.js";
import { OptionsSheet } from "./options-sheet.js";
import { Picker, selectedEntry } from "./picker.js";
import { Preview } from "./preview.js";
import {
  currentWidget,
  initialState,
  isAddCell,
  reduce,
} from "./state.js";

/** The catalogued built-in widgets, populating the default registry once. */
function builtinWidgetEntries(): readonly WidgetMetaEntry[] {
  const registry = defaultRegistry();
  if (registry.size() === 0) registerAllBuiltins(registry);
  return registry.listMeta();
}

export interface RunConfigInput {
  readonly env?: NodeJS.ProcessEnv;
  /** Directly pre-supplied config; primarily used by smoke tests. */
  readonly preloaded?: { config: AgentlineConfig; path: string };
}

export interface RunConfigResult {
  readonly saved: boolean;
  readonly path: string;
}

export async function runConfigCommand(input: RunConfigInput = {}): Promise<RunConfigResult> {
  const { config, path } = await resolveStartingConfig(input);
  const env = resolveEnv(input);
  // Resolve `config.theme` once at startup so the live preview matches what
  // the real statusline renders. Themes don't change during an edit session.
  const previewTheme = await resolveConfiguredTheme(config.theme, { env });
  const glyphs = pickGlyphs({ env });
  const { waitUntilExit, unmount, savedRef } = mountEditor(config, path, previewTheme, glyphs);
  await waitUntilExit;
  unmount();
  return { saved: savedRef.value, path };
}

interface AppProps {
  readonly initialConfig: AgentlineConfig;
  readonly path: string;
  readonly previewTheme: Theme | null;
  readonly glyphs: EditorGlyphs;
  readonly onSaved: (saved: boolean) => void;
}

function App({ initialConfig, path, previewTheme, glyphs, onSaved }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reduce, initialConfig.lines, (lines) => initialState(lines));
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerHighlight, setPickerHighlight] = useState(0);
  const saveInFlight = React.useRef(false);
  const bindings = useMemo(
    () => listBindings(initialConfig.keymap as Record<string, string> | undefined),
    [initialConfig.keymap],
  );
  const widgetEntries = useMemo(() => builtinWidgetEntries(), []);
  const optionsWidget = state.mode === "options" ? currentWidget(state) : undefined;

  const resetPicker = useCallback(() => {
    setPickerQuery("");
    setPickerHighlight(0);
  }, []);

  const onSave = useCallback(async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    try {
      await saveEditedConfig({
        path,
        base: initialConfig,
        lines: state.lines,
      });
      dispatch({ type: "mark-clean" });
      setStatusMessage(`saved → ${path}`);
      onSaved(true);
    } catch (err) {
      setStatusMessage(`save failed: ${(err as Error).message}`);
    } finally {
      saveInFlight.current = false;
    }
  }, [initialConfig, onSaved, path, state.lines]);

  useInput((input, key) => {
    if (showHelp) {
      setShowHelp(false);
      return;
    }
    if (state.mode === "picker") {
      if (key.escape) {
        dispatch({ type: "close-picker" });
        resetPicker();
        return;
      }
      if (key.return) {
        const picked = selectedEntry(widgetEntries, pickerQuery, pickerHighlight);
        dispatch(
          picked
            ? { type: "apply-picker", widgetType: picked.type }
            : { type: "close-picker" },
        );
        resetPicker();
        return;
      }
      if (key.upArrow) return setPickerHighlight((h) => Math.max(0, h - 1));
      if (key.downArrow) return setPickerHighlight((h) => h + 1);
      if (key.backspace || key.delete) {
        setPickerQuery((q) => q.slice(0, -1));
        return setPickerHighlight(0);
      }
      if (input.length === 1 && input >= " " && !key.ctrl && !key.meta) {
        setPickerQuery((q) => q + input);
        return setPickerHighlight(0);
      }
      return;
    }
    if (state.mode === "options") {
      if (key.escape) return dispatch({ type: "close-options" });
      if (input === "v") return dispatch({ type: "toggle-hidden" });
      if (input === "l") return dispatch({ type: "toggle-raw" });
      if (input === "m") return dispatch({ type: "cycle-merge" });
      return;
    }
    // ── edit scope ───────────────────────────────────────────────────────
    if (input === "?") return setShowHelp(true);
    if (key.escape || input === "q") {
      onSaved(false);
      exit();
      return;
    }
    if (input === "S" || (key.ctrl && input === "s")) {
      if (saveInFlight.current) return;
      void onSave();
      return;
    }
    if (key.leftArrow)
      return dispatch(key.shift ? { type: "move-widget", dx: -1 } : { type: "move-cursor", dx: -1 });
    if (key.rightArrow)
      return dispatch(key.shift ? { type: "move-widget", dx: 1 } : { type: "move-cursor", dx: 1 });
    if (key.upArrow)
      return dispatch(key.shift ? { type: "move-widget", dy: -1 } : { type: "move-cursor", dy: -1 });
    if (key.downArrow)
      return dispatch(key.shift ? { type: "move-widget", dy: 1 } : { type: "move-cursor", dy: 1 });
    if (key.return) {
      // On the +add cell → open the picker. On a widget → open the options
      // sheet (the "edit this widget" affordance). Verbs `a`/`r`/`d`/`o`
      // remain available too.
      if (isAddCell(state)) {
        return dispatch({ type: "open-picker", target: "insert" });
      }
      return dispatch({ type: "open-options" });
    }
    if (input === "a") return dispatch({ type: "open-picker", target: "insert" });
    if (input === "r") return dispatch({ type: "open-picker", target: "replace" });
    if (input === "d" || input === "x" || key.delete || key.backspace) {
      return dispatch({ type: "delete" });
    }
    if (input === "o") return dispatch({ type: "open-options" });
  });

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true }, "agentline config"),
    React.createElement(Text, { dimColor: true }, `editing ${path}`),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Preview, {
        base: initialConfig,
        lines: state.lines,
        cursor: state.cursor,
        theme: previewTheme,
        glyphs,
      }),
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, footerText(bindings, state.mode)),
    ),
    state.dirty
      ? React.createElement(
          Text,
          { color: "yellow" },
          " ● unsaved changes — press S to save, q/Esc to discard ",
        )
      : null,
    statusMessage
      ? React.createElement(Text, { color: "green" }, ` ${statusMessage} `)
      : null,
    state.mode === "picker"
      ? React.createElement(Picker, {
          title: state.pickerTarget === "replace" ? "Replace the widget with…" : "Insert a widget",
          entries: widgetEntries,
          query: pickerQuery,
          highlight: pickerHighlight,
        })
      : null,
    optionsWidget ? React.createElement(OptionsSheet, { widget: optionsWidget }) : null,
    showHelp ? helpOverlay(bindings) : null,
  );
}

const SCOPE_ORDER = ["edit", "picker", "options", "any"] as const;
const SCOPE_HEADING: Record<KeyBinding["scope"], string> = {
  edit: "in the preview",
  picker: "in the widget picker",
  options: "in the options sheet",
  any: "any time",
};

function helpOverlay(bindings: readonly KeyBinding[]): React.ReactElement {
  const widest = bindings.reduce((n, b) => Math.max(n, b.key.length), 0);
  const groups: React.ReactElement[] = [];
  for (const scope of SCOPE_ORDER) {
    const inScope = bindings.filter((b) => b.scope === scope);
    if (inScope.length === 0) continue;
    groups.push(
      React.createElement(Text, { key: `h-${scope}`, bold: true }, `\n${SCOPE_HEADING[scope]}`),
      ...inScope.map((b) =>
        React.createElement(
          Text,
          { key: `${scope}-${b.action}` },
          `  ${b.key.padEnd(widest, " ")}  ${b.description}`,
        ),
      ),
    );
  }
  return React.createElement(
    Box,
    { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, marginTop: 1 },
    React.createElement(Text, { bold: true }, "keys — press any key to close"),
    ...groups,
  );
}

/** Compact one-line footer of the keys active in the current mode (plus `any`),
 *  keyed by action so it survives `config.keymap` overrides. */
const FOOTER_LABEL: Record<string, string> = {
  "move-cursor": "move",
  "move-cursor-row": "row",
  "move-widget": "move widget",
  "move-widget-row": "widget→row",
  "edit-widget": "+add or edit",
  add: "add",
  replace: "replace",
  delete: "delete",
  options: "options",
  save: "save",
  "picker-filter": "type to filter",
  "picker-navigate": "navigate",
  "picker-confirm": "confirm",
  "picker-cancel": "cancel",
  "toggle-visible": "show/hide",
  "toggle-label": "label",
  "cycle-spacing": "spacing",
  "options-close": "close",
  quit: "quit",
  help: "help",
};

function footerText(bindings: readonly KeyBinding[], mode: KeyBinding["scope"]): string {
  return bindings
    .filter((b) => b.scope === mode || b.scope === "any")
    .map((b) => `${b.key} ${FOOTER_LABEL[b.action] ?? b.description}`)
    .join(" · ");
}

function mountEditor(
  config: AgentlineConfig,
  path: string,
  previewTheme: Theme | null,
  glyphs: EditorGlyphs,
): {
  readonly waitUntilExit: Promise<void>;
  readonly unmount: () => void;
  readonly savedRef: { value: boolean };
} {
  const savedRef = { value: false };
  const inst = render(
    React.createElement(App, {
      initialConfig: config,
      path,
      previewTheme,
      glyphs,
      onSaved: (saved) => {
        savedRef.value = saved;
      },
    }),
  );
  return { waitUntilExit: inst.waitUntilExit(), unmount: inst.unmount, savedRef };
}

async function resolveStartingConfig(
  input: RunConfigInput,
): Promise<{ config: AgentlineConfig; path: string }> {
  if (input.preloaded) return input.preloaded;
  const env = resolveEnv(input);
  const paths = resolveConfigPaths(env);
  try {
    const loaded = await loadConfig({ env });
    return { config: loaded.config, path: paths.userConfig };
  } catch {
    return { config: DEFAULT_CONFIG, path: paths.userConfig };
  }
}

export default runConfigCommand;
