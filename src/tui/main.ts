/**
 * Ink-based TUI editor entry (`agentline edit` — §1.1 F10, §5.5).
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
 * Add / replace share a three-step picker drill-down:
 *
 *   step 1 (`picker-group`)   — empty search ⇒ pick a category;
 *                                typing flips the view to a flat global
 *                                widget list filtered by substring (across
 *                                every category at once). Picking a result
 *                                from the flat view skips step 2.
 *   step 2 (`picker-widget`)  — pick a widget within the chosen category.
 *   step 3 (`picker-variant`) — pick a variant (skipped for widgets that
 *                                have none in the catalogue).
 */

import { Box, Text, render, useApp, useInput, type Key as KeyEvent } from "ink";
import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { loadConfig } from "../config/load.js";
import { resolveConfigPaths } from "../config/paths.js";
import type { AgentlineConfig } from "../config/types.js";
import { listBindings, type KeyBinding, type KeyScope } from "../keys/index.js";
import { projectGate } from "../lib/claude-project.js";
import { resolveEnv } from "../lib/env.js";
import { readNerdFontStatus, stateDir as nerdFontStateDir } from "../lib/nerd-font.js";
import { isErr, tryAsync } from "../lib/result.js";
import type { Theme } from "../theme/index.js";
import { resolveConfiguredTheme } from "../theme/resolve.js";

import { maybeRefresh } from "../update-check/index.js";
import { defaultRegistry, registerAllBuiltins, type WidgetMetaEntry } from "../widgets/index.js";
import { widgetMeta, widgetVariants, type WidgetCategory } from "../widgets/catalog.js";

import { pickGlyphs, type EditorGlyphs } from "./glyphs.js";
import { saveEditedConfig } from "./persist.js";
import {
  PickerGroup,
  PickerSearch,
  PickerVariant,
  PickerWidget,
  categoriesWithWidgets,
  clampIndex,
  filterWidgets,
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

/** Human-readable label for the currently selected widget (catalogue name + type). */
function selectedWidgetLabel(type: string): string {
  const meta = widgetMeta(type);
  return meta ? `${meta.name} (${type})` : type;
}

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

export async function runConfigCommand(input: RunConfigInput = {}): Promise<RunConfigResult> {
  const gate = await projectGate({
    command: "edit",
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.stdin !== undefined ? { stdin: input.stdin } : {}),
  });
  if (gate === "skip") return { saved: false, path: "", skipped: true };
  // Fire-and-forget npm-registry probe so the cache that `agentline
  // doctor` reads is reasonably fresh after every editor session.
  // Wrapped in a swallowed `.catch` for belt-and-braces — `maybeRefresh`
  // already never throws, but a bare `void` would let a runtime
  // surprise (e.g. unhandled rejection in a test seam) bubble.
  void maybeRefresh().catch(() => undefined);
  const { config, path } = await resolveStartingConfig(input);
  const env = resolveEnv(input);
  const previewTheme = await resolveConfiguredTheme(config.theme, { env });
  const glyphs = pickGlyphs({ env });
  const nerdFontAvailable = resolveNerdFontAvailable(env);
  const { waitUntilExit, unmount, savedRef } = mountEditor(
    config,
    path,
    previewTheme,
    glyphs,
    nerdFontAvailable,
  );
  await waitUntilExit;
  unmount();
  return { saved: savedRef.value, path };
}

/**
 * Read the install-time Nerd Font sentinel. When the sentinel is missing
 * (user skipped `agentline install`, or installed an older version) we
 * assume a font is available rather than locking the toggle — a missed
 * disable is recoverable, a false lock is annoying.
 */
function resolveNerdFontAvailable(env: NodeJS.ProcessEnv): boolean {
  const home = env.HOME ?? "";
  if (!home) return true;
  const status = readNerdFontStatus(nerdFontStateDir(env, home));
  return status === null ? true : status.available;
}

interface AppProps {
  readonly initialConfig: AgentlineConfig;
  readonly path: string;
  readonly previewTheme: Theme | null;
  readonly glyphs: EditorGlyphs;
  /** `false` when the install probe didn't find a Nerd Font; locks the `g` toggle to "off". */
  readonly nerdFontAvailable: boolean;
  readonly onSaved: (saved: boolean) => void;
}

function App({
  initialConfig,
  path,
  previewTheme,
  glyphs,
  nerdFontAvailable,
  onSaved,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reduce, initialConfig, (cfg) =>
    initialState(cfg.lines, nerdFontAvailable ? cfg.glyphs : "off"),
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
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

  // Types already placed in the layout. The picker hides these so the user
  // can't add the same widget twice. In replace mode the widget under the
  // cursor is on its way out — but we only let its type back into the
  // picker when the widget has variants, so users on a variant-bearing
  // widget can still swap variants via replace. For variant-less widgets,
  // re-picking the same type would be a no-op and is excluded.
  const usedTypes = useMemo(() => {
    const set = new Set<string>();
    for (const line of state.lines) for (const w of line.widgets) set.add(w.type);
    if (state.mode !== "edit" && state.pickerTarget.kind === "replace") {
      const line = state.lines[state.pickerTarget.line];
      const target = line?.widgets[state.pickerTarget.index];
      if (target && widgetVariants(target.type).length > 0) set.delete(target.type);
    }
    return set;
  }, [state.lines, state.mode, state.pickerTarget]);

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
      setStatusMessage(
        `saved → ${path} — run "agentline start" to preview, or Restart Claude Code`,
      );
      onSaved(true);
    } catch (err) {
      setStatusMessage(`save failed: ${(err as Error).message}`);
    } finally {
      saveInFlight.current = false;
    }
  }, [initialConfig, onSaved, path, state.lines, state.glyphs]);

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
    [stepQuery, stepHighlight, widgetEntries, usedTypes],
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
    [state.pickerDraft.category, stepQuery, stepHighlight, widgetEntries, usedTypes],
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
    [state.pickerDraft.widgetType, stepHighlight],
  );

  const handleEdit = useCallback(
    (input: string, key: KeyEvent): void => {
      if (key.escape || input === "q") {
        onSaved(false);
        exit();
        return;
      }
      if (input === "s" || input === "S" || (key.ctrl && input === "s")) {
        if (saveInFlight.current) return;
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
    [exit, nerdFontAvailable, onSave, onSaved, state],
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
    state.mode === "picker-widget" && state.pickerDraft.category
      ? React.createElement(PickerWidget, {
          category: state.pickerDraft.category as WidgetCategory,
          entries: widgetEntries,
          query: stepQuery,
          highlight: stepHighlight,
          exclude: usedTypes,
        })
      : null,
    state.mode === "picker-variant" && state.pickerDraft.widgetType
      ? React.createElement(PickerVariant, {
          widgetType: state.pickerDraft.widgetType,
          mode: "fresh",
          highlight: stepHighlight,
        })
      : null,
  );
}

/** Map the reducer's mode (which includes the three picker steps) onto the
 *  display scope used by the footer. */
function modeToScope(mode: EditorMode): KeyScope {
  if (isPickerMode(mode)) return "picker";
  return "edit";
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
  delete: "delete",
  save: "save",
  "toggle-glyphs": "glyphs on/off",
  "picker-filter": "type to filter",
  "picker-navigate": "navigate",
  "picker-confirm": "confirm",
  "picker-back": "back",
  quit: "quit",
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
 * ANSI: erase display + erase scrollback (xterm `3J`) + cursor home.
 * Mirrors `ansi-escapes.clearTerminal` — the same sequence Ink itself
 * emits when content overflows the viewport (ink.js:122). Prepended to
 * every Ink frame so each redraw paints into a blank screen *and* a
 * blank scrollback buffer.
 *
 * Why `3J` and not just `2J`: `2J` only erases the visible region;
 * xterm-compatible terminals push the just-cleared rows into scrollback
 * rather than discarding them. In terminals where alt-screen entry is
 * ignored (Warp, tmux without `alternate-screen on`, some Apple Terminal
 * configurations), `2J` alone lets every prior editor frame accumulate
 * in the host's scrollback — exactly the stacking symptom users see when
 * arrow-navigating. The `3J` wipes that scrollback so stacking can't
 * survive even when alt-screen isn't fully effective.
 */
const FULLSCREEN_RESET = "\x1b[2J\x1b[3J\x1b[H";

/**
 * Wrap a TTY stream so every `.write()` call is preceded by a
 * cursor-home + clear-screen sequence. Ink's default log-update pipeline
 * tracks the cursor between frames and issues cursor-up / erase-line
 * sequences to redraw in place. That breaks down whenever the previous
 * frame overflowed the viewport (the cursor caps at the top of the
 * terminal, leaving any scrolled-out content visible above the new
 * frame). Forcing each frame to start at (1,1) on a cleared buffer
 * eliminates the stacked-frame artefact users see when the editor
 * preview wraps onto extra rows.
 *
 * Non-TTY streams (CI, redirected output, vitest) are returned
 * unchanged so test transcripts and recorded output stay clean.
 */
export function fullscreenStream(target: NodeJS.WriteStream): NodeJS.WriteStream {
  if (!target.isTTY) return target;
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === "write") {
        return (chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
          const data = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
          // Use Reflect.apply so the underlying stream's `this` is the
          // real WriteStream — the EventEmitter machinery relies on it.
          return Reflect.apply(t.write as (...args: unknown[]) => boolean, t, [
            `${FULLSCREEN_RESET}${data}`,
            ...rest,
          ]);
        };
      }
      const value = Reflect.get(t, prop, receiver);
      // Functions on a Node stream must be invoked with the real stream
      // as `this` — the Proxy is not a substitute for the EventEmitter.
      return typeof value === "function" ? value.bind(t) : value;
    },
  }) as NodeJS.WriteStream;
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
  // POSIX exit-code convention for a signal-terminated process is
  // `128 + signal_number`. SIGTERM = 15.
  const SIGTERM_EXIT_CODE = 128 + 15;
  const onSignal = (signal: NodeJS.Signals): void => {
    restore();
    // Ink owns SIGINT via exitOnCtrlC (default true). For SIGTERM we
    // re-raise the default exit code so the host shell sees the signal
    // rather than a polite zero exit.
    if (signal === "SIGTERM") process.exit(SIGTERM_EXIT_CODE);
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
  nerdFontAvailable: boolean,
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
      nerdFontAvailable,
      onSaved: (saved) => {
        savedRef.value = saved;
      },
    }),
    {
      stdout: fullscreenStream(process.stdout),
      patchConsole: false,
      exitOnCtrlC: true,
    },
  );
  // Restore the alt-screen on every exit path — save, q, Esc, exception.
  const waitUntilExit = inst.waitUntilExit().finally(leaveAltScreen);
  return { waitUntilExit, unmount: inst.unmount, savedRef };
}

async function resolveStartingConfig(
  input: RunConfigInput,
): Promise<{ config: AgentlineConfig; path: string }> {
  if (input.preloaded) {
    return { config: pruneStaleWidgets(input.preloaded.config), path: input.preloaded.path };
  }
  const env = resolveEnv(input);
  const paths = resolveConfigPaths(env);
  try {
    const loaded = await loadConfig({ env });
    return { config: pruneStaleWidgets(loaded.config), path: paths.userConfig };
  } catch {
    return { config: DEFAULT_CONFIG, path: paths.userConfig };
  }
}

/**
 * Drop widgets whose `type` isn't in the catalogue. Such widgets can't be
 * recreated through the picker (`add` / `update` only know catalogued
 * types), so leaving them in the edit view would show navigable chips
 * the user has no way to repair. Removing them at load time keeps the
 * editor's `lines` and the preview slots in lock-step, and a subsequent
 * save cleans the on-disk config.
 */
export function pruneStaleWidgets(config: AgentlineConfig): AgentlineConfig {
  let changed = false;
  const lines = config.lines.map((line) => {
    const kept = line.widgets.filter((w) => widgetMeta(w.type) !== undefined);
    if (kept.length === line.widgets.length) return line;
    changed = true;
    return { ...line, widgets: kept };
  });
  return changed ? { ...config, lines } : config;
}

export default runConfigCommand;
