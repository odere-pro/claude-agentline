/**
 * Type-level surface for the config-mutation API.
 *
 * Split out from `mutate.ts` so the consumer-visible vocabulary (specs,
 * error class, hard caps) lives in one place a caller can import without
 * pulling in the load / write helpers (`loadConfig`, `writeJsonIdempotent`,
 * `withFileLock`) the pure ops never touch. `mutate.ts` re-exports
 * everything here for backwards compatibility — existing
 * `import { … } from "./mutate.js"` call sites are unaffected.
 */

import type { WidgetConfig } from "../types.js";

/** Hard cap on statusline rows the editor and CLI will create. */
export const MAX_LINES = 3;

export class ConfigMutationError extends Error {
  constructor(message: string) {
    super(`agentline: ${message}`);
    this.name = "ConfigMutationError";
  }
}

/**
 * A `(line, at)` pair identifying a widget slot in the config tree.
 * `line` is the row index (0..MAX_LINES-1); `at` is the widget index
 * within the row. Every mutation spec carries this pair in some form —
 * `AddWidgetSpec` and `MoveWidgetSpec` make `at` optional so the
 * mutation can default to "append to the line"; remove/replace/option
 * specs require both. Naming the pair stops it reading as two unrelated
 * primitives at the call site.
 */
export interface WidgetCoord {
  /** Target line index (0..MAX_LINES-1). */
  readonly line: number;
  /** Position within the line. */
  readonly at: number;
}

export interface AddWidgetSpec {
  /** Target line index (0..MAX_LINES-1); higher than the current count pads with empty lines. */
  readonly line: number;
  /** Insert position within the line; defaults to the end. */
  readonly at?: number;
  readonly widget: WidgetConfig;
}

export interface RemoveWidgetSpec extends WidgetCoord {}

export interface ReplaceWidgetSpec extends WidgetCoord {
  readonly widget: WidgetConfig;
}

export interface MoveWidgetSpec {
  readonly fromLine: number;
  readonly fromAt: number;
  readonly toLine: number;
  /**
   * Destination index, interpreted in the line *after* the source widget
   * has been removed; defaults to the end of the destination line.
   */
  readonly toAt?: number;
}

export interface SetWidgetOptionSpec extends WidgetCoord {
  readonly key: string;
  readonly value: unknown;
}

export interface SaveOptions {
  readonly env?: NodeJS.ProcessEnv;
}
