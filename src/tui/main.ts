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
 *
 * Add / replace / update share a three-step picker drill-down:
 *
 *   step 1 (`picker-group`)   — pick a category.
 *   step 2 (`picker-widget`)  — pick a widget within that category.
 *   step 3 (`picker-variant`) — pick a variant (skipped for widgets that
 *                                have none in the catalogue).
 *
 * `u` (update) jumps straight to step 3 for the selected widget.
 */

import { Box, Text, render, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { loadConfig } from "../config/load.js";
import { resolveConfigPaths } from "../config/paths.js";
import type { AgentlineConfig } from "../config/types.js";
import { listBindings, type KeyBinding, type KeyScope } from "../keys/index.js";
import { resolveEnv } from "../lib/env.js";
import type { Theme } from "../theme/index.js";
import { resolveConfiguredTheme } from "../theme/resolve.js";

import {
  defaultRegistry,
  registerAllBuiltins,
  type WidgetMetaEntry,
} from "../widgets/index.js";
import { widgetVariants, type WidgetCategory } from "../widgets/catalog.js";

import { pickGlyphs, type EditorGlyphs } from "./glyphs.js";
import { saveEditedConfig } from "./persist.js";
import {
  PickerGroup,
  PickerVariant,
  PickerWidget,
  categoriesWithWidgets,
  selectedAt,
  variantRows,
  widgetsInCategory,
} from "./picker.js";
import { Preview } from "./preview.js";
import {
  currentWidget,
  initialState,
  isAddCell,
  isPickerMode,
  reduce,
  type EditorMode,
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
  const [state, dispatch] = useReducer(
    reduce,
    initialConfig,
    (cfg) => initialState(cfg.lines, cfg.glyphs),
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);
  // Per-step transient UI state — reset on every mode change so each step
  // starts with a clean filter and the highlight at row 0.
  const [stepQuery, setStepQuery] = useState("");
  const [stepHighlight, setStepHighlight] = useState(0);
  const saveInFlight = React.useRef(false);
  const bindings = useMemo(
    () => listBindings(initialConfig.keymap as Record<string, string> | undefined),
    [initialConfig.keymap],
  );
  const widgetEntries = useMemo(() => builtinWidgetEntries(), []);

  // Reset per-step state on every transition.
  useEffect(() => {
    setStepQuery("");
    setStepHighlight(0);
  }, [state.mode, state.pickerDraft.category, state.pickerDraft.widgetType]);

  const onSave = useCallback(async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    try {
      await saveEditedConfig({
        path,
        base: initialConfig,
        lines: state.lines,
        glyphs: state.glyphs,
      });
      dispatch({ type: "mark-clean" });
      setStatusMessage(`saved → ${path}`);
      onSaved(true);
    } catch (err) {
      setStatusMessage(`save failed: ${(err as Error).message}`);
    } finally {
      saveInFlight.current = false;
    }
  }, [initialConfig, onSaved, path, state.lines, state.glyphs]);

  useInput((input, key) => {
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    // ── picker steps ─────────────────────────────────────────────────────
    if (state.mode === "picker-group") {
      const cats = categoriesWithWidgets(widgetEntries);
      if (key.escape) return dispatch({ type: "picker-back" });
      if (key.return) {
        const cat = selectedAt(cats, stepHighlight);
        if (cat) dispatch({ type: "pick-category", category: cat });
        return;
      }
      if (key.upArrow) return setStepHighlight((h) => Math.max(0, h - 1));
      if (key.downArrow)
        return setStepHighlight((h) => Math.min(cats.length - 1, h + 1));
      return;
    }
    if (state.mode === "picker-widget") {
      const category = state.pickerDraft.category;
      if (!category) {
        // Should never happen — defensive fall-through.
        dispatch({ type: "picker-back" });
        return;
      }
      if (key.escape) return dispatch({ type: "picker-back" });
      if (key.return) {
        const matches = widgetsInCategory(widgetEntries, category, stepQuery);
        const picked = selectedAt(matches, stepHighlight);
        if (picked) dispatch({ type: "pick-widget", widgetType: picked.type });
        return;
      }
      if (key.upArrow) return setStepHighlight((h) => Math.max(0, h - 1));
      if (key.downArrow) {
        const matches = widgetsInCategory(widgetEntries, category, stepQuery);
        return setStepHighlight((h) => Math.min(Math.max(0, matches.length - 1), h + 1));
      }
      if (key.backspace || key.delete) {
        setStepQuery((q) => q.slice(0, -1));
        return setStepHighlight(0);
      }
      if (input.length === 1 && input >= " " && !key.ctrl && !key.meta) {
        setStepQuery((q) => q + input);
        return setStepHighlight(0);
      }
      return;
    }
    if (state.mode === "picker-variant") {
      const widgetType = state.pickerDraft.widgetType;
      if (!widgetType) {
        dispatch({ type: "picker-back" });
        return;
      }
      const mode: "update" | "fresh" =
        state.pickerTarget.kind === "update" ? "update" : "fresh";
      const rows = variantRows(widgetType, mode);
      if (key.escape) return dispatch({ type: "picker-back" });
      if (key.return) {
        const row = selectedAt(rows, stepHighlight);
        if (row) dispatch({ type: "pick-variant", variantId: row.id });
        return;
      }
      if (key.upArrow) return setStepHighlight((h) => Math.max(0, h - 1));
      if (key.downArrow)
        return setStepHighlight((h) => Math.min(rows.length - 1, h + 1));
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
      return dispatch(
        key.shift ? { type: "move-widget", dx: -1 } : { type: "move-cursor", dx: -1 },
      );
    if (key.rightArrow)
      return dispatch(
        key.shift ? { type: "move-widget", dx: 1 } : { type: "move-cursor", dx: 1 },
      );
    if (key.upArrow)
      return dispatch(
        key.shift ? { type: "move-widget", dy: -1 } : { type: "move-cursor", dy: -1 },
      );
    if (key.downArrow)
      return dispatch(
        key.shift ? { type: "move-widget", dy: 1 } : { type: "move-cursor", dy: 1 },
      );
    if (key.return) {
      if (isAddCell(state)) return dispatch({ type: "open-picker", intent: "add" });
      // On a populated widget ↵ is a no-op now — `u`/`r` cover the
      // edit paths the options sheet used to surface.
      return;
    }
    if (input === "a") return dispatch({ type: "open-picker", intent: "add" });
    if (input === "r") return dispatch({ type: "open-picker", intent: "replace" });
    if (input === "u") {
      const widget = currentWidget(state);
      if (!widget) {
        setStatusMessage("update: select a widget first");
        return;
      }
      if (widgetVariants(widget.type).length === 0) {
        setStatusMessage(`no variants for "${widget.type}"`);
        return;
      }
      return dispatch({ type: "open-update" });
    }
    if (input === "d" || input === "x" || key.delete || key.backspace) {
      return dispatch({ type: "delete" });
    }
    if (input === "g") {
      dispatch({ type: "toggle-glyphs" });
      // Surface the new value so the user can see the toggle landed even if
      // their terminal lacks a Nerd Font (the prepended glyphs would render
      // as tofu boxes — without a status line they'd look like noise).
      const next = state.glyphs === "nerd-font" ? "off" : "nerd-font";
      setStatusMessage(`glyphs: ${next}`);
      return;
    }
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
        // Synthesize an effective base that reflects the editor's live
        // glyph mode so toggling `g` is visible immediately. Everything
        // else — theme, global, powerline — comes from the loaded config.
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
          " ● unsaved changes — press S to save, q/Esc to discard ",
        )
      : null,
    statusMessage
      ? React.createElement(Text, { color: "green" }, ` ${statusMessage} `)
      : null,
    state.mode === "picker-group"
      ? React.createElement(PickerGroup, {
          entries: widgetEntries,
          highlight: stepHighlight,
          glyphs,
        })
      : null,
    state.mode === "picker-widget" && state.pickerDraft.category
      ? React.createElement(PickerWidget, {
          category: state.pickerDraft.category as WidgetCategory,
          entries: widgetEntries,
          query: stepQuery,
          highlight: stepHighlight,
        })
      : null,
    state.mode === "picker-variant" && state.pickerDraft.widgetType
      ? React.createElement(PickerVariant, {
          widgetType: state.pickerDraft.widgetType,
          mode: state.pickerTarget.kind === "update" ? "update" : "fresh",
          highlight: stepHighlight,
        })
      : null,
    showHelp ? helpOverlay(bindings) : null,
  );
}

const SCOPE_ORDER = ["edit", "picker", "any"] as const;
const SCOPE_HEADING: Record<KeyScope, string> = {
  edit: "in the preview",
  picker: "in the widget picker",
  any: "any time",
};

/** Map the reducer's mode (which includes the three picker steps) onto the
 *  display scope used by the footer + help overlay. */
function modeToScope(mode: EditorMode): KeyScope {
  if (isPickerMode(mode)) return "picker";
  return "edit";
}

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

/** Short labels for the two-line footer. Falls back to the binding's description. */
const FOOTER_LABEL: Record<string, string> = {
  "move-cursor": "move",
  "move-cursor-row": "row",
  "move-widget": "move widget",
  "move-widget-row": "widget→row",
  "edit-widget": "+add",
  add: "add",
  replace: "replace",
  update: "update (variant)",
  delete: "delete",
  save: "save",
  "toggle-glyphs": "glyphs on/off",
  "picker-filter": "type to filter",
  "picker-navigate": "navigate",
  "picker-confirm": "confirm",
  "picker-back": "back",
  quit: "quit",
  help: "help",
};

/** Actions that describe navigation / motion — surfaced on the footer's first line. */
const MOTION_ACTIONS: ReadonlySet<string> = new Set([
  "move-cursor",
  "move-cursor-row",
  "move-widget",
  "move-widget-row",
  "picker-navigate",
]);

/** Footer split into a navigation/motion row and an actions row. */
export function footerLines(
  bindings: readonly KeyBinding[],
  mode: EditorMode,
): { readonly motion: string; readonly actions: string } {
  const scope = modeToScope(mode);
  const inScope = bindings.filter((b) => b.scope === scope || b.scope === "any");
  const fmt = (b: KeyBinding) => `${b.key} ${FOOTER_LABEL[b.action] ?? b.description}`;
  // Motion bindings come from the current scope only — `any`-scope bindings
  // (quit, help) belong on the actions line so they sit beside the verbs.
  const motion = inScope.filter((b) => b.scope !== "any" && MOTION_ACTIONS.has(b.action));
  const actions = inScope.filter((b) => b.scope === "any" || !MOTION_ACTIONS.has(b.action));
  return {
    motion: motion.map(fmt).join(" · "),
    actions: actions.map(fmt).join(" · "),
  };
}

/**
 * Enter the terminal's alternate-screen buffer for the duration of an
 * editor session and return a finalizer that restores the prior shell
 * view. Both halves are no-ops when stdout is not a TTY (CI, redirected
 * output, vitest), so non-interactive consumers are unaffected.
 *
 * Why alt-screen: Ink's default inline rendering commits the previous
 * frame to scrollback every time the rendered tree's height changes,
 * so opening and closing a picker / overlay leaves stale copies in
 * scrollback. Painting into the alt buffer keeps every frame in place
 * and restores the user's prior shell on exit.
 *
 * The finalizer also fires from a SIGINT / SIGTERM handler so a Ctrl-C
 * mid-edit doesn't leave the terminal stuck in the alt buffer.
 */
export function enterAltScreen(stream: NodeJS.WriteStream = process.stdout): () => void {
  if (!stream.isTTY) return () => undefined;
  const ENTER = "\x1b[?1049h";
  const LEAVE = "\x1b[?1049l";
  stream.write(ENTER);
  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    stream.write(LEAVE);
  };
  const onSignal = (signal: NodeJS.Signals): void => {
    restore();
    // Ink owns SIGINT via exitOnCtrlC (default true). For SIGTERM we
    // re-raise the default exit code so the host shell sees the signal
    // rather than a polite zero exit.
    if (signal === "SIGTERM") process.exit(143);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  return (): void => {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    restore();
  };
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
  const leaveAltScreen = enterAltScreen();
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
    { patchConsole: false, exitOnCtrlC: true },
  );
  // Restore the alt-screen on every exit path — save, q, Esc, exception.
  const waitUntilExit = inst.waitUntilExit().finally(leaveAltScreen);
  return { waitUntilExit, unmount: inst.unmount, savedRef };
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
