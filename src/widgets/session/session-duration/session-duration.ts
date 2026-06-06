/**
 * `session-duration` widget (session family, §7.2).
 *
 * Renders the host-reported session elapsed time, e.g. `12m 30s` or `1h 5m`.
 * Reads `ctx.stdin.cost.totalDurationMs` directly — the host pre-computes
 * this scalar; no transcript aggregation, no reset axis, NO ctx.clock usage.
 *
 * Hides when `cost` or `totalDurationMs` is absent.
 *
 * Format: `Xm Ys` for durations < 1 hour; `Xh Ym` for >= 1 hour
 * (seconds are dropped for hour-scale durations to stay compact).
 * This is a purpose-built local formatter — importing the rate-limits
 * `formatDuration` would be a cross-family coupling smell.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

interface SessionDurationOptions {
  readonly label?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Format a duration in milliseconds as `Xm Ys` (< 1 hour) or `Xh Ym` (>= 1 hour).
 * Input is clamped to zero for negative values.
 */
function formatSessionDuration(ms: number): string {
  const clamped = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const hours = Math.floor(clamped / HOUR_MS);
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((clamped % MINUTE_MS) / 1000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export const sessionDurationWidget = defineWidget<SessionDurationOptions>(
  "session-duration",
  (ctx, settings): Cell => {
    const cost = ctx.stdin.cost;
    if (!cost || cost.totalDurationMs === undefined) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${formatSessionDuration(cost.totalDurationMs)}` };
  },
);
