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
 * the caller hands in. The render hot path must not spawn
 * subprocesses to detect width (§1.2 N3).
 */

export const FALLBACK_WIDTH = 80;

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

export function detectTerminalWidth(source: WidthSource): number {
  const fromEnv = parsePositiveInt(source.env["COLUMNS"]);
  if (fromEnv !== null) return fromEnv;
  const fromStream =
    source.stream && typeof source.stream.columns === "number"
      ? source.stream.columns
      : null;
  if (fromStream !== null && Number.isInteger(fromStream) && fromStream > 0) {
    return fromStream;
  }
  return FALLBACK_WIDTH;
}

export interface WidthModeOptions {
  readonly mode: WidthMode;
  readonly compactThreshold: number;
}

export const DEFAULT_COMPACT_THRESHOLD = 60;

export function applyWidthMode(
  detectedWidth: number,
  options: WidthModeOptions,
): AppliedWidth {
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
        effectiveWidth: Math.max(1, detectedWidth - 40),
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
