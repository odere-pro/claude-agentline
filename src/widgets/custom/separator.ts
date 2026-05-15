/**
 * `separator` widget (§7.8.1).
 *
 * Renders a single configurable character. The TUI cycles `Space`
 * through `| - , · ␣` (§5.5); we expose that set as `SEPARATOR_CYCLE`
 * so the editor can enumerate it without re-stating the spec.
 */

import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface SeparatorOptions {
  readonly char?: string;
}

export const SEPARATOR_CYCLE: readonly string[] = Object.freeze(["|", "-", ",", "·", "␣"]);

const DEFAULT_SEPARATOR = "|";

function clampToOneChar(value: string | undefined, fallback: string): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  /*
   * Take the first user-perceived character. Iterator splits surrogate
   * pairs / combining marks at code-point boundaries.
   */
  const first = value[Symbol.iterator]().next().value;
  return typeof first === "string" ? first : fallback;
}

export const separatorWidget = defineWidget<SeparatorOptions>(
  "separator",
  (_ctx, settings): Cell => {
    const char = clampToOneChar(settings.options.char, DEFAULT_SEPARATOR);
    return { text: char };
  },
);
