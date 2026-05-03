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
import { DEFAULT_KEY_BINDINGS, listBindings } from "../keys/index.js";

import { saveEditedConfig } from "./persist.js";
import {
  currentWidget,
  initialState,
  reduce,
  type EditorAction,
  type EditorState,
} from "./state.js";

const ROTATING_TYPES: readonly string[] = [
  "model",
  "git-branch",
  "git-changes",
  "context-percentage",
  "tokens-total",
  "cost",
  "session-usage",
  "flex-separator",
  "clock",
  "separator",
];

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
  const bindings = useMemo(
    () => listBindings(initialConfig.keymap as Record<string, string> | undefined),
    [initialConfig.keymap],
  );
  const widget = currentWidget(state);

  const onSave = useCallback(async () => {
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
    }
  }, [initialConfig, onSaved, path, state.lines]);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onSaved(false);
      exit();
      return;
    }
    if (input === "S") {
      void onSave();
      return;
    }
    if (key.upArrow) return dispatch({ type: "navigate", delta: -1 });
    if (key.downArrow) return dispatch({ type: "navigate", delta: 1 });
    if (key.leftArrow) return dispatch({ type: "select-widget", delta: -1 });
    if (key.rightArrow) return dispatch({ type: "select-widget", delta: 1 });
    if (input === "a") {
      const next = nextRotatingType(widget?.type);
      return dispatch({ type: "add", widgetType: next });
    }
    if (input === "d") return dispatch({ type: "delete" });
    if (input === "h") return dispatch({ type: "toggle-hidden" });
    if (input === "r") return dispatch({ type: "toggle-raw" });
    if (input === "m") return dispatch({ type: "cycle-merge" });
    if (input === "t") return dispatch({ type: "set-type", widgetType: rotateType(widget) });
  });

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { bold: true }, "agentline config"),
    React.createElement(Text, { dimColor: true }, `editing ${path}`),
    React.createElement(Box, { flexDirection: "column", marginTop: 1 }, ...renderWidgets(state)),
    React.createElement(Box, { marginTop: 1 }, React.createElement(Text, null, footerText(bindings))),
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
  );
}

function renderWidgets(state: EditorState): React.ReactElement[] {
  const line = state.lines[0];
  if (!line || line.widgets.length === 0) {
    return [
      React.createElement(
        Text,
        { dimColor: true, key: "empty" },
        "(no widgets — press a to add)",
      ),
    ];
  }
  return line.widgets.map((w, idx) => {
    const selected = idx === state.cursor.widget;
    const flags = [
      w.hidden ? "hidden" : null,
      w.rawValue ? "raw" : null,
      w.merged && w.merged !== "off" ? `merged=${w.merged}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return React.createElement(
      Text,
      { key: `${idx}:${w.type}`, color: selected ? "cyan" : undefined },
      `${selected ? "▸ " : "  "}${w.type}${flags ? `  · ${flags}` : ""}`,
    );
  });
}

function footerText(bindings: readonly { key: string; description: string }[]): string {
  const subset = bindings
    .filter((b) =>
      [
        "navigate",
        "add",
        "delete",
        "toggle-hidden",
        "toggle-raw",
        "cycle-merge",
        "back",
      ].includes(
        DEFAULT_KEY_BINDINGS.find((d) => d.description === b.description)?.action ?? "",
      ),
    )
    .map((b) => `${b.key} ${b.description}`)
    .join("  ");
  return `${subset}  S save`;
}

function nextRotatingType(current: string | undefined): string {
  if (!current) {
    return ROTATING_TYPES[0] ?? "model";
  }
  const idx = ROTATING_TYPES.indexOf(current);
  return ROTATING_TYPES[(idx + 1) % ROTATING_TYPES.length] ?? "model";
}

function rotateType(widget: { type: string } | undefined): string {
  return nextRotatingType(widget?.type);
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
  const env = input.env ?? process.env;
  const paths = resolveConfigPaths(env);
  try {
    const loaded = await loadConfig({ env });
    return { config: loaded.config, path: paths.userConfig };
  } catch {
    return { config: DEFAULT_CONFIG, path: paths.userConfig };
  }
}

export default runConfigCommand;
