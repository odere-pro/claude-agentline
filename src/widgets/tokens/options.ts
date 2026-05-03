/**
 * Shared option parsing for token / cost widgets. Every reset-axis
 * widget declares `options.reset` (§7.3); a missing or unrecognised
 * value falls back to `session` so the renderer can never crash on a
 * typo.
 */

import type { ResetAxis } from "../../tokens/index.js";

const VALID_AXES: ReadonlySet<ResetAxis> = new Set<ResetAxis>([
  "session",
  "block",
  "day",
  "week",
  "model",
  "effort",
]);

export function resolveResetAxis(value: unknown): ResetAxis {
  if (typeof value !== "string") return "session";
  return VALID_AXES.has(value as ResetAxis) ? (value as ResetAxis) : "session";
}
