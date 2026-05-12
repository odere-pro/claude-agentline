/**
 * Ink-based TUI editor entry (`agentline config` — §1.1 F10, §5.5).
 *
 * This module is loaded ONLY by a dynamic `import("./tui.mjs")` from
 * cli.mjs. tsup builds it as a separate output file so Ink + React
 * never appear in the render-path bundle (§1.2 N3).
 *
 * The renderer is intentionally thin: it observes the pure state
 * machine in `state.ts`, dispatches `EditorAction`s on key input,
 * and writes the merged config to disk via `saveEditedConfig`.
 *
 * `runConfigCommand` is exposed as the entry point cli.ts calls.
 * The exported `default` function makes the file usable as a Node
 * script for ad-hoc invocation, but the canonical API is named.
 */

import { Box, Text, render, useApp, useInput } from "ink";
import React, { useCallback, useMemo, useReducer, useState } from "react";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { loadConfig } from "../config/load.js";
import { resolveConfigPaths } from "../config/paths.js";
import type { AgentlineConfig } from "../config/types.js";
import { listBindings } from "../keys/index.js";
import { resolveEnv } from "../lib/env.js";

import { defaultRegistry, registerAllBuiltins, type WidgetMetaEntry } from "../widgets/index.js";

import { saveEditedConfig } from "./persist.js";
import { Picker, selectedEntry } from "./picker.js";
import { Preview } from "./preview.js";
import { initialState, reduce, type EditorAction, type EditorState } from "./state.js";

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
  const { waitUntilExit, unmount, savedRef } = mountEditor(config, path);
  await waitUntilExit;
  unmount();
  return { saved: savedRef.value, path };
}

interface AppProps {
  readonly initialConfig: AgentlineConfig;
  readonly path: string;
  readonly onSaved: (saved: boolean) => void;
}

function reducerWithLog(state: EditorState, action: EditorAction): EditorState {
  return reduce(state, action);
}

function App({ initialConfig, path, onSaved }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reducerWithLog, initialConfig.lines, (lines) =>
    initialState(lines),
  );
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
        dispatch(picked ? { type: "apply-picker", widgetType: picked.type } : { type: "close-picker" });
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
    if (input === "?") return setShowHelp(true);
    if (key.escape || input === "q") {
      onSaved(false);
      exit();
      return;
    }
    if (input === "S") {
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
    if (input === "a") return dispatch({ type: "open-picker", target: "insert" });
    if (input === "r") return dispatch({ type: "open-picker", target: "replace" });
    if (input === "x") return dispatch({ type: "delete" });
    if (input === "v") return dispatch({ type: "toggle-hidden" });
    if (input === "m") return dispatch({ type: "cycle-merge" });
    if (input === "l") return dispatch({ type: "toggle-raw" });
  });

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true }, "agentline config"),
    React.createElement(Text, { dimColor: true }, `editing ${path}`),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Preview, { base: initialConfig, lines: state.lines, width: previewWidth() }),
    ),
    React.createElement(Box, { flexDirection: "column", marginTop: 1 }, ...renderWidgets(state)),
    React.createElement(Box, { marginTop: 1 }, React.createElement(Text, { dimColor: true }, footerText(bindings))),
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
    showHelp ? helpOverlay(bindings) : null,
  );
}

function helpOverlay(
  bindings: readonly { key: string; description: string }[],
): React.ReactElement {
  return React.createElement(
    Box,
    { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, marginTop: 1 },
    React.createElement(Text, { bold: true }, "keys (press any key to close)"),
    ...bindings.map((b) =>
      React.createElement(Text, { key: b.description }, `  ${b.key.padEnd(10, " ")}  ${b.description}`),
    ),
  );
}

/** Width to compose the preview against — the terminal width, minus the box chrome. */
function previewWidth(): number {
  const columns = process.stdout.columns;
  return Math.max(20, (typeof columns === "number" && columns > 0 ? columns : 120) - 4);
}

function renderWidgets(state: EditorState): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  state.lines.forEach((line, lineIdx) => {
    const onLine = state.cursor.line === lineIdx;
    out.push(
      React.createElement(
        Text,
        { key: `line${lineIdx}`, color: onLine ? "cyan" : undefined, dimColor: !onLine },
        `line ${lineIdx}${onLine ? "  ◂" : ""}`,
      ),
    );
    if (line.widgets.length === 0) {
      out.push(
        React.createElement(
          Text,
          { key: `line${lineIdx}-empty`, dimColor: true },
          "    (empty — press a to add a widget here)",
        ),
      );
      return;
    }
    line.widgets.forEach((w, idx) => {
      const selected = onLine && idx === state.cursor.widget;
      const flags = [
        w.hidden ? "hidden" : null,
        w.rawValue ? "no label" : null,
        w.merged && w.merged !== "off" ? w.merged : null,
      ]
        .filter(Boolean)
        .join(", ");
      out.push(
        React.createElement(
          Text,
          { key: `line${lineIdx}-w${idx}`, color: selected ? "cyan" : undefined },
          `  ${selected ? "▸ " : "  "}${String(idx).padStart(2, " ")}  ${w.type}${flags ? `  [${flags}]` : ""}`,
        ),
      );
    });
  });
  return out;
}

/** Compact one-line footer of the edit-mode keys, drawn from the active keymap. */
function footerText(bindings: readonly { key: string; description: string }[]): string {
  const short: Record<string, string> = {
    "move the selection within the row": "move",
    "move the selection to the adjacent row": "row",
    "move the selected widget within its row": "move widget",
    "move the selected widget to the adjacent row": "widget→row",
    "add a widget": "add",
    "replace the selected widget": "replace",
    "delete the selected widget": "delete",
    "show / hide the selected widget": "hide",
    "spacing to neighbour: full / single space / none": "spacing",
    "show / hide the widget's own label": "label",
    save: "save",
    "quit (prompts if there are unsaved changes)": "quit",
    "toggle the help overlay": "help",
  };
  return bindings.map((b) => `${b.key} ${short[b.description] ?? b.description}`).join(" · ");
}

function mountEditor(config: AgentlineConfig, path: string): {
  readonly waitUntilExit: Promise<void>;
  readonly unmount: () => void;
  readonly savedRef: { value: boolean };
} {
  const savedRef = { value: false };
  const inst = render(
    React.createElement(App, {
      initialConfig: config,
      path,
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
