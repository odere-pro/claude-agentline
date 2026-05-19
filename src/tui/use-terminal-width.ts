/**
 * Live terminal-width hook for the TUI editor.
 *
 * Ink's own resize path (`ink.js` `resized` → `calculateLayout` +
 * `onRender`) re-lays-out Yoga and repaints the *existing* element tree
 * but never re-invokes React function components. A component that
 * derives a width from `process.stdout.columns` therefore freezes that
 * value at its last React render: a bare terminal resize (no keypress)
 * would leave the preview's bordered box and wrap threshold stale until
 * the next dispatch.
 *
 * This hook closes that gap: it subscribes to the stdout `"resize"`
 * event and pushes the new column count through React state, forcing a
 * re-render so consumers recompute against the current width. The pure
 * `readColumns` reader is exported for unit tests.
 */

import { useEffect, useState } from "react";

import { FALLBACK_WIDTH } from "../render/width.js";

/** Minimal shape of the stdout stream this hook reads/observes. */
export interface ColumnsSource {
  readonly columns?: number;
  on?: (event: string, listener: () => void) => unknown;
  off?: (event: string, listener: () => void) => unknown;
}

/**
 * Current usable column count: the stream's `columns` when it is a
 * positive integer, else `FALLBACK_WIDTH` (matches the render path and
 * `Preview`'s own `resolveColumns` fallback so widths stay consistent).
 */
export function readColumns(source: ColumnsSource | undefined): number {
  const cols = source ? source.columns : undefined;
  return typeof cols === "number" && Number.isInteger(cols) && cols > 0 ? cols : FALLBACK_WIDTH;
}

/**
 * Returns the live terminal width, re-rendering the calling component on
 * every terminal resize. `source` defaults to `process.stdout` and is a
 * parameter only so tests can inject a fake emitter.
 */
export function useTerminalWidth(source: ColumnsSource | undefined = process.stdout): number {
  const [width, setWidth] = useState(() => readColumns(source));
  useEffect(() => {
    if (!source || typeof source.on !== "function") return;
    const onResize = (): void => setWidth(readColumns(source));
    // Re-sync once on mount in case the size changed between the
    // initial state computation and the listener being attached.
    onResize();
    source.on("resize", onResize);
    return () => {
      if (typeof source.off === "function") source.off("resize", onResize);
    };
  }, [source]);
  return width;
}
