/**
 * Debounced filesystem watcher for `agentline preview --watch` (§5.6).
 *
 * Wraps `fs.watch` with three concerns the caller shouldn't have to
 * track manually:
 *
 *   - **Debounce.** Editors often emit several events per save
 *     (atomic rename + chmod + content change); we coalesce them
 *     into a single notification via an 80 ms timer.
 *   - **Atomic-write recovery.** Many editors save by writing to a
 *     temp file then renaming over the target — `fs.watch` reports
 *     this as a `rename` event and silently stops watching. We
 *     detect that, close the dead watcher, and re-attach.
 *   - **Cleanup.** The returned `Disposer` tears down the watcher
 *     and cancels any pending debounce / re-attach timers so the
 *     listener can be disposed cleanly on SIGINT or test teardown
 *     without leaving dangling timers in the event loop.
 */

import { watch as fsWatch, type FSWatcher } from "node:fs";

export type ConfigChangeListener = () => void;
export type Disposer = () => void;

const DEBOUNCE_MS = 80;
const RENAME_REATTACH_DELAY_MS = 100;
const ERROR_REATTACH_DELAY_MS = 500;
const MAX_ERROR_REATTACHES = 20;

export function watchConfigFile(
  filePath: string,
  onChange: ConfigChangeListener,
): Disposer {
  let watcher: FSWatcher | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let reattach: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let errorReattaches = 0;

  const clearDebounce = (): void => {
    if (debounce !== null) {
      clearTimeout(debounce);
      debounce = null;
    }
  };

  const clearReattach = (): void => {
    if (reattach !== null) {
      clearTimeout(reattach);
      reattach = null;
    }
  };

  const fire = (): void => {
    clearDebounce();
    debounce = setTimeout(() => {
      debounce = null;
      if (!disposed) onChange();
    }, DEBOUNCE_MS);
  };

  const scheduleReattach = (delayMs: number): void => {
    clearReattach();
    if (disposed) return;
    // Cap error-driven reattach loop so a permanently inaccessible file
    // (deleted, permission denied) does not pin the event loop forever.
    // Successful rename-driven reattaches reset the counter inside attach().
    if (delayMs === ERROR_REATTACH_DELAY_MS) {
      errorReattaches += 1;
      if (errorReattaches > MAX_ERROR_REATTACHES) return;
    }
    reattach = setTimeout(() => {
      reattach = null;
      attach();
    }, delayMs);
  };

  const attach = (): void => {
    if (disposed) return;
    try {
      watcher = fsWatch(filePath, (event) => {
        errorReattaches = 0;
        fire();
        // Atomic writes (write-tmp + rename) emit a `rename` event on
        // the watched path; the underlying watcher silently dies, so
        // close it and re-attach to catch the next save. Two rename
        // events in rapid succession (Linux inotify can produce them)
        // would otherwise schedule overlapping `attach()` calls and
        // leave a duplicate FSWatcher delivering doubled onChange.
        // `scheduleReattach` clears any pending reattach before
        // arming a fresh one, so the second close+reschedule wins.
        if (event === "rename") {
          watcher?.close();
          watcher = null;
          scheduleReattach(RENAME_REATTACH_DELAY_MS);
        }
      });
      watcher.on("error", () => {
        watcher?.close();
        watcher = null;
        scheduleReattach(ERROR_REATTACH_DELAY_MS);
      });
    } catch {
      scheduleReattach(ERROR_REATTACH_DELAY_MS);
    }
  };

  attach();

  return () => {
    if (disposed) return;
    disposed = true;
    clearDebounce();
    clearReattach();
    watcher?.close();
    watcher = null;
  };
}
