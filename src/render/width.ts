/**
 * Terminal width detection and width-mode application (§4.5, §8.2).
 *
 * Resolution order (§8.2 step 1):
 *   1. `COLUMNS` env (positive integer)
 *   2. ioctl via `stream.columns` (a Node tty exposes this when
 *      attached to a real terminal)
 *   3. fallback 80
 *
 * Pure and synchronous — no I/O beyond reading the env snapshot
 * the caller hands in. The render path must not spawn subprocesses
 * to detect width (§1.2 N3).
 */

import { DEFAULT_COMPACT_THRESHOLD } from "../config/defaults.js";

export { DEFAULT_COMPACT_THRESHOLD };

export const FALLBACK_WIDTH = 80;

/**
 * Sentinel "width" used when the terminal width cannot be detected
 * (no `COLUMNS`, no tty `stream.columns`). The host spawns the
 * statusline with a pipe for stdout and sends no width on stdin, so
 * this is the common live case. Composing against this value disables
 * width-based wrapping entirely — each configured line stays on one
 * row and the host handles horizontal overflow, rather than wrapping
 * against a guessed fallback (§8.2 step 1). Large enough that no real
 * line can exceed it; small enough to never overflow arithmetic.
 */
export const NO_WRAP_WIDTH = 1_000_000;

export type WidthMode = "full" | "full-minus-40" | "full-until-compact";

export interface WidthSource {
  /** A snapshot of process.env (or a test stub). */
  readonly env: NodeJS.ProcessEnv;
  /** Optional writable stream that may expose `columns`. */
  readonly stream?: { readonly columns?: number };
}

export interface AppliedWidth {
  /** Effective width the renderer should target. */
  readonly effectiveWidth: number;
  /** True when the line is below `compactThreshold`. */
  readonly isCompact: boolean;
  /** The raw detected terminal width (pre-mode). */
  readonly detectedWidth: number;
}

export interface DetectedWidth {
  /** The resolved width — a real value when `detected`, else `FALLBACK_WIDTH`. */
  readonly width: number;
  /**
   * True only when the width came from a real signal (`COLUMNS` env or
   * a tty `stream.columns`). False means we fell back — callers should
   * not wrap or width-trim against a guessed value.
   */
  readonly detected: boolean;
}

/**
 * Resolve the terminal width and report whether it was actually
 * detected. Precedence (§8.2 step 1): `COLUMNS` env → tty
 * `stream.columns` → fallback (`detected: false`).
 */
export function detectTerminalWidthInfo(source: WidthSource): DetectedWidth {
  const fromEnv = parsePositiveInt(source.env["COLUMNS"]);
  if (fromEnv !== null) return { width: fromEnv, detected: true };
  const fromStream =
    source.stream && typeof source.stream.columns === "number" ? source.stream.columns : null;
  if (fromStream !== null && Number.isInteger(fromStream) && fromStream > 0) {
    return { width: fromStream, detected: true };
  }
  return { width: FALLBACK_WIDTH, detected: false };
}

export function detectTerminalWidth(source: WidthSource): number {
  return detectTerminalWidthInfo(source).width;
}

export interface WidthModeOptions {
  readonly mode: WidthMode;
  readonly compactThreshold: number;
}

const COMPACT_OVERHEAD_COLUMNS = 40;

export function applyWidthMode(detectedWidth: number, options: WidthModeOptions): AppliedWidth {
  const compactThreshold =
    Number.isInteger(options.compactThreshold) && options.compactThreshold > 0
      ? options.compactThreshold
      : DEFAULT_COMPACT_THRESHOLD;
  switch (options.mode) {
    case "full":
      return {
        effectiveWidth: Math.max(1, detectedWidth),
        isCompact: detectedWidth < compactThreshold,
        detectedWidth,
      };
    case "full-minus-40":
      return {
        effectiveWidth: Math.max(1, detectedWidth - COMPACT_OVERHEAD_COLUMNS),
        isCompact: detectedWidth < compactThreshold,
        detectedWidth,
      };
    case "full-until-compact":
      return {
        effectiveWidth: Math.max(1, detectedWidth),
        isCompact: detectedWidth < compactThreshold,
        detectedWidth,
      };
  }
}

function parsePositiveInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
