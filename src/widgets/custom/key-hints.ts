/**
 * `key-hints` widget (§7.8). Surfaces a Claude Code REPL keyboard
 * shortcut, rotating across renders so the line keeps reminding the
 * user about a different binding every interval.
 *
 * Determinism (§1.2 N7): the choice is seeded from `ctx.clock.now()` —
 * `idx = floor(now / intervalMs) % hints.length`. Identical clock +
 * config ⇒ identical hint, so the golden harness stays byte-stable.
 *
 * Hidden when the resolved hint list is empty.
 */

import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
  /** Rotation interval in milliseconds. Clamped to ≥ 1000 ms. */
  readonly intervalMs?: number;
  /** User-supplied hint list overrides the built-in catalogue. */
  readonly hints?: readonly string[];
}

const DEFAULT_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 1_000;

/**
 * Curated set of Claude Code REPL hints. Kept short so the rotation
 * stays readable inside a statusline cell. The first entry is what
 * users see immediately after install (no clock seed in tests yet).
 */
export const DEFAULT_KEY_HINTS: readonly string[] = Object.freeze([
  "/ commands",
  "@ file",
  "! bash",
  "# memorize",
  "Esc interrupt",
  "Ctrl+R expand",
  "Shift+Tab modes",
  "Ctrl+_ undo",
  "↑ history",
  "?? help",
]);

function resolveHints(provided: readonly string[] | undefined): readonly string[] {
  if (!provided || provided.length === 0) return DEFAULT_KEY_HINTS;
  const cleaned: string[] = [];
  for (const raw of provided) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed.length > 0) cleaned.push(trimmed);
  }
  return cleaned.length > 0 ? Object.freeze(cleaned) : DEFAULT_KEY_HINTS;
}

function resolveInterval(provided: number | undefined): number {
  if (typeof provided !== "number" || !Number.isFinite(provided)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(provided));
}

/**
 * Pure helper exported for tests: returns the index that `render`
 * would pick at the given clock instant.
 */
export function pickHintIndex(nowMs: number, intervalMs: number, length: number): number {
  if (length <= 0) return 0;
  const safeNow = Number.isFinite(nowMs) ? nowMs : 0;
  const slot = Math.floor(safeNow / intervalMs);
  const idx = ((slot % length) + length) % length;
  return idx;
}

export const keyHintsWidget = defineWidget<Options>("key-hints", (ctx, settings): Cell => {
  const hints = resolveHints(settings.options.hints);
  if (hints.length === 0) return { text: "", hidden: true };
  const intervalMs = resolveInterval(settings.options.intervalMs);
  const nowMs = ctx.clock.now().getTime();
  const idx = pickHintIndex(nowMs, intervalMs, hints.length);
  const hint = hints[idx] ?? hints[0] ?? "";
  if (!hint) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${hint}` };
});
