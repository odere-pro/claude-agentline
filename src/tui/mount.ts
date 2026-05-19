/**
 * Mount / unmount lifecycle for the TUI editor:
 *
 *   - `fullscreenStream` wraps stdout so every Ink frame paints into a
 *     blank screen + blank scrollback, eliminating the stacked-frame
 *     artefact users see when the preview wraps.
 *   - `enterAltScreen` enters the terminal's alternate-screen buffer
 *     for the duration of the session and registers SIGINT / SIGTERM
 *     handlers that restore the prior shell view and, for SIGTERM,
 *     await any in-flight save before exiting.
 *   - `SaveTracker` is the shared mutable container the editor's
 *     `onSave` and the SIGTERM handler both read.
 *   - `mountEditor` is the entry the host (`runConfigCommand`) drives.
 *   - `resolveStartingConfig` + `pruneStaleWidgets` are the small
 *     input-resolution helpers that decide what config to hand `App`.
 */

import { render } from "ink";
import React from "react";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { loadConfig } from "../config/load.js";
import { resolveConfigPaths } from "../config/paths.js";
import type { AgentlineConfig } from "../config/types.js";
import { resolveEnv } from "../lib/env.js";
import type { Theme } from "../theme/index.js";
import { widgetMeta } from "../widgets/catalog.js";

import { App, type RunConfigInput } from "./app.js";
import type { EditorGlyphs } from "./glyphs.js";

/**
 * Mutable container exposing the in-flight save promise. The editor and
 * the signal handler (in `enterAltScreen`) share one instance so a
 * SIGTERM mid-save can await the atomic write before terminating —
 * otherwise the rename-temp step gets killed and leaves an orphan
 * `.tmp.<hex>` file in the agentline config directory.
 *
 * `inFlight` is `null` between saves; while a save is running it holds
 * the awaitable returned by `onSave`. Settled promises clear the field
 * back to `null` so subsequent saves can claim the slot.
 */
export interface SaveTracker {
  inFlight: Promise<void> | null;
}

export function createSaveTracker(): SaveTracker {
  return { inFlight: null };
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
 * Wrap a TTY stream so every Ink *frame* write is preceded by a
 * cursor-home + clear-screen sequence. Ink's default log-update pipeline
 * tracks the cursor between frames and issues cursor-up / erase-line
 * sequences to redraw in place. That breaks down whenever the previous
 * frame overflowed the viewport (the cursor caps at the top of the
 * terminal, leaving any scrolled-out content visible above the new
 * frame). Forcing each frame to start at (1,1) on a cleared buffer
 * eliminates the stacked-frame artefact users see when the editor
 * preview wraps onto extra rows.
 *
 * The prefix is gated on a trailing newline. log-update emits every
 * frame as `eraseLines(N) + output + '\n'`, so frame writes always end
 * in `\n`. Ink also issues short ANSI control writes through the same
 * stream — `cliCursor.hide()` writes `\x1b[?25l` from `App`'s
 * `componentDidMount`, `log.clear()` writes `eraseLines(N)`, and
 * `cliCursor.show()` writes `\x1b[?25h` on unmount. Those control
 * writes carry no newline, and prepending `FULLSCREEN_RESET` to them
 * wipes the just-rendered frame: React's commit order is
 * `resetAfterCommit` (which paints the first frame) before
 * `commitLayoutEffects` (which fires `componentDidMount` and the
 * cursor-hide), so without this gate the user sees a blank screen
 * until the next stdin event triggers a fresh frame.
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
          const isFrame = data.endsWith("\n");
          const payload = isFrame ? `${FULLSCREEN_RESET}${data}` : data;
          /*
           * Use Reflect.apply so the underlying stream's `this` is the
           * real WriteStream — the EventEmitter machinery relies on it.
           */
          return Reflect.apply(t.write as (...args: unknown[]) => boolean, t, [payload, ...rest]);
        };
      }
      const value = Reflect.get(t, prop, receiver);
      /*
       * Functions on a Node stream must be invoked with the real stream
       * as `this` — the Proxy is not a substitute for the EventEmitter.
       */
      return typeof value === "function" ? value.bind(t) : value;
    },
  }) as NodeJS.WriteStream;
}

export interface EnterAltScreenOptions {
  /**
   * Optional callback the SIGTERM handler awaits before restoring the
   * scrollback and calling `process.exit`. Pass a getter (not a
   * promise) so the handler reads the *current* in-flight save at the
   * moment the signal arrives; an arrow function that returns
   * `saveTracker.inFlight` is the intended shape. Returning `null` (or
   * a promise that rejects) lets the handler exit immediately.
   *
   * The exit waits at most one promise — if the callback returns a
   * promise that never settles, the process stays alive until the
   * caller's host kills it. That trade-off is preferable to killing a
   * mid-flight atomic write and leaving an orphan `.tmp.<hex>` file
   * in the agentline config directory.
   */
  readonly awaitBeforeExit?: () => Promise<void> | null;
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
export function enterAltScreen(
  stream: NodeJS.WriteStream = process.stdout,
  options: EnterAltScreenOptions = {},
): () => void {
  if (!stream.isTTY) return () => undefined;
  const ENTER = "\x1b[?1049h";
  const LEAVE = "\x1b[?1049l";
  stream.write(ENTER);
  /*
   * Paint a clean canvas immediately so the editor's first frame lands
   * on a blank, cursor-home buffer even on terminals where `?1049h` is
   * a no-op (Warp, tmux without `alternate-screen on`, some Apple
   * Terminal configurations). Without this, the first Ink frame can
   * sit invisible until a stdin event nudges Ink to redraw — users see
   * the editor only after their first keystroke.
   */
  stream.write(FULLSCREEN_RESET);
  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    stream.write(LEAVE);
  };
  /*
   * POSIX exit-code convention for a signal-terminated process is
   * `128 + signal_number`. SIGTERM = 15.
   */
  const SIGTERM_SIGNAL = 15;
  const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL;
  const onSignal = (signal: NodeJS.Signals): void => {
    /*
     * Ink owns SIGINT via exitOnCtrlC (default true). For SIGINT we
     * restore the scrollback and let Ink drive exit. For SIGTERM we
     * wait for any in-flight save (so an atomic write isn't killed
     * between fsync and rename) and then re-raise the default exit
     * code so the host shell sees the signal rather than a polite
     * zero exit.
     */
    if (signal !== "SIGTERM") {
      restore();
      return;
    }
    const inFlight = options.awaitBeforeExit?.();
    if (inFlight) {
      /*
       * Keep the alt-screen up until the save settles so the user
       * doesn't see a half-redrawn shell while the rename completes.
       * `.finally` runs regardless of resolution; we deliberately
       * suppress any rejection — the save callback already surfaces
       * errors to the editor's status line.
       */
      void inFlight.finally(() => {
        restore();
        process.exit(SIGTERM_EXIT_CODE);
      });
    } else {
      restore();
      process.exit(SIGTERM_EXIT_CODE);
    }
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  return (): void => {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    restore();
  };
}

export interface MountEditorOptions {
  readonly config: AgentlineConfig;
  readonly path: string;
  readonly previewTheme: Theme | null;
  readonly glyphs: EditorGlyphs;
  /**
   * Resolved process env. Threaded into the preview/picker so family
   * identity (glyph degradation) resolves through the same inputs as the
   * live statusline render.
   */
  readonly env: NodeJS.ProcessEnv;
}

export function mountEditor(opts: MountEditorOptions): {
  readonly waitUntilExit: Promise<void>;
  readonly unmount: () => void;
  readonly savedRef: { value: boolean };
} {
  const savedRef = { value: false };
  const saveTracker = createSaveTracker();
  const leaveAltScreen = enterAltScreen(process.stdout, {
    awaitBeforeExit: () => saveTracker.inFlight,
  });
  const element = React.createElement(App, {
    initialConfig: opts.config,
    path: opts.path,
    previewTheme: opts.previewTheme,
    glyphs: opts.glyphs,
    env: opts.env,
    onSaved: (saved) => {
      savedRef.value = saved;
    },
    saveTracker,
  });
  const inst = render(element, {
    stdout: fullscreenStream(process.stdout),
    patchConsole: false,
    exitOnCtrlC: true,
  });
  // Restore the alt-screen on every exit path — save, q, Esc, exception.
  const waitUntilExit = inst.waitUntilExit().finally(leaveAltScreen);
  return { waitUntilExit, unmount: inst.unmount, savedRef };
}

export async function resolveStartingConfig(
  input: RunConfigInput,
): Promise<{ config: AgentlineConfig; path: string }> {
  if (input.preloaded) {
    return {
      config: pruneStaleWidgets(input.preloaded.config),
      path: input.preloaded.path,
    };
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
