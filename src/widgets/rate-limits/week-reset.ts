/**
 * Shared `resetWeekday` / `resetHour` option resolver for the weekly
 * rate-limit widgets (§7.5).
 *
 * The host's real weekly reset is account-specific (e.g. a Thursday-noon
 * reset) and is *not* in the Claude Code stdin payload, so the user pins
 * it via widget options. This validates those options into a
 * `WeekResetOpts` the tokens layer understands. Returns `undefined` when
 * neither option is a valid integer in range — callers then fall back to
 * the historical local-Monday-00:00 default.
 */

import type { WeekResetOpts } from "../../tokens/index.js";

export interface WeekResetOptions {
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). */
  readonly resetWeekday?: number;
  /** Hour of day 0–23; minutes are pinned to 0. */
  readonly resetHour?: number;
}

function validInt(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

export function resolveWeekReset(options: WeekResetOptions): WeekResetOpts | undefined {
  const weekday = validInt(options.resetWeekday, 0, 6);
  const hour = validInt(options.resetHour, 0, 23);
  if (weekday === undefined && hour === undefined) return undefined;
  return {
    ...(weekday !== undefined ? { weekday } : {}),
    ...(hour !== undefined ? { hour } : {}),
  };
}
