/**
 * `useSaveFlow` — owns the async save lifecycle for the editor.
 *
 * Returns the `onSave` callback the input layer dispatches plus the
 * `statusMessage` and `setStatusMessage` pair the status banner reads.
 * Tracks mount via a ref so the in-flight save can skip its React state
 * setters and the `onSaved` callback once the editor has unmounted.
 *
 * INVARIANT (load-bearing — preserved verbatim from app.ts):
 *   `saveTracker.inFlight` must be assigned synchronously BEFORE any
 *   await. The signal handler in `enterAltScreen` and a second `s`
 *   keypress both read the tracker; if the assignment happened after
 *   an await, either could observe `null` while the save was actually
 *   running and tear the atomic write. The deferred-resolver pattern
 *   below assigns the promise sync, then settles it inside the IIFE's
 *   `try / finally`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { DictTranslator } from "../../../core/i18n/index.js";
import type { AgentlineConfig, LineConfig } from "../../../data/config/types.js";

import type { SaveTracker } from "../mount.js";
import { saveEditedConfig, triggerBackgroundRerender } from "../persist/persist.js";

/**
 * Serialise the post-save background rerender behind any previous one
 * still in flight. Without this, rapid saves can let save N's background
 * render finish *after* save N+1's and overwrite the fresher cache with
 * stale output. The chain swallows rejections so a transient failure
 * doesn't poison subsequent saves. Exported so the contract is testable
 * without mounting React.
 *
 * INVARIANT (load-bearing for cross-context observation):
 *   `next` is captured locally BEFORE the `.catch().finally()` runs so
 *   the housekeeping check `tracker.bgRerender === next` references the
 *   exact promise this call published. A later `chainBackgroundRerender`
 *   may replace `tracker.bgRerender` with its own newer chain reference
 *   while this `finally` is still scheduled; the identity comparison is
 *   what prevents the older finalizer from clearing the newer chain. The
 *   SIGTERM handler in `enterAltScreen` reads `bgRerender` from the same
 *   tracker and is harmless under the same invariant — it only awaits the
 *   currently-published reference, never the local `next` snapshot.
 */
export function chainBackgroundRerender(
  tracker: SaveTracker,
  savedConfig: AgentlineConfig,
  trigger: (cfg: AgentlineConfig) => Promise<void> = triggerBackgroundRerender,
): Promise<void> {
  const prev = tracker.bgRerender ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => trigger(savedConfig));
  tracker.bgRerender = next;
  /*
   * Housekeeping consumes `next` separately so a rejection propagated to
   * the returned promise's caller doesn't escape here as an unhandled
   * rejection. Always `.catch` before `.finally` for that reason.
   */
  void next
    .catch(() => undefined)
    .finally(() => {
      if (tracker.bgRerender === next) tracker.bgRerender = null;
    });
  return next;
}

export interface UseSaveFlowInput {
  readonly initialConfig: AgentlineConfig;
  readonly path: string;
  readonly lines: readonly LineConfig[];
  readonly saveTracker: SaveTracker;
  readonly onSaved: (saved: boolean) => void;
  readonly markClean: () => void;
  readonly t: DictTranslator;
}

export interface UseSaveFlowResult {
  readonly onSave: () => Promise<void>;
  readonly statusMessage: string;
  readonly setStatusMessage: (next: string) => void;
}

export function useSaveFlow(input: UseSaveFlowInput): UseSaveFlowResult {
  const { initialConfig, path, lines, saveTracker, onSaved, markClean, t } = input;
  const [statusMessage, setStatusMessage] = useState<string>("");

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
          lines,
        });
        void chainBackgroundRerender(saveTracker, savedConfig);
        if (mountedRef.current) {
          markClean();
          setStatusMessage(t("app.saved", { path }));
          onSaved(true);
        }
      } catch (err) {
        if (mountedRef.current) {
          setStatusMessage(
            t("app.save-failed", { message: (err as Error).message }),
          );
        }
      } finally {
        if (saveTracker.inFlight === promise) saveTracker.inFlight = null;
        resolveSave();
      }
    })();
    return promise;
  }, [initialConfig, lines, markClean, onSaved, path, saveTracker, t]);

  return { onSave, statusMessage, setStatusMessage };
}
