/**
 * Terminal width detection (§4.5, §8.2).
 *
 * Resolution order (§8.2 step 1):
 *   1. `COLUMNS` env (positive integer)
 *   2. ioctl via `stream.columns` (a Node tty exposes this when
 *      attached to a real terminal)
 *   3. no width — the caller must not elide against a guess
 *
 * The renderer composes against the full detected width. It reserves no
 * columns for host chrome: the host hands the statusline command the same
 * width it uses itself, so anything held back is space the user configured
 * a widget into and never sees (issue #318).
 *
 * Pure and synchronous — no I/O beyond reading the env snapshot
 * the caller hands in. The render path must not spawn subprocesses
 * to detect width (§1.2 N3).
 */

export const FALLBACK_WIDTH = 80;

/**
 * Sentinel "width" used when the terminal width cannot be detected
 * (no `COLUMNS`, no tty `stream.columns`). This is the *uncommon* case:
 * the host spawns the statusline command with `COLUMNS`/`LINES` copied
 * from its own tty, so a real width is normally present. It applies to
 * pipes, cron, and `--fixture` replays. Composing against this value
 * disables width-based elision entirely — each configured line stays on
 * one row (as it always does, issue #304) and the host handles
 * horizontal overflow, rather than eliding against a guessed fallback
 * (§8.2 step 1). Large enough that no real line can exceed it; small
 * enough to never overflow arithmetic.
 */
export const NO_WRAP_WIDTH = 1_000_000;

export interface WidthSource {
  /** A snapshot of process.env (or a test stub). */
  readonly env: NodeJS.ProcessEnv;
  /** Optional writable stream that may expose `columns`. */
  readonly stream?: { readonly columns?: number };
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

function parsePositiveInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
