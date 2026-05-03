/**
 * `session-usage` and `weekly-usage` widgets (§7.5).
 *
 * Both compute total tokens consumed in a fixed window (5-h block for
 * session-usage, the rolling 7-day boundary for weekly-usage) and
 * render a usage indicator. Display is cycled by the TUI via
 * `options.display`:
 *
 *   - `percent`    `65%` (default)
 *   - `bar`        `█████░░░░░░░` (default 12 cells)
 *   - `short-bar`  `███░░░` (default 6 cells)
 *
 * When `options.limit` is unset or non-positive, the widget renders the
 * raw `formatCount(used)` instead — quotas are deployment-specific and
 * the bin never assumes a hard cap.
 *
 * Colour grades: ratio < 0.6 → tokens-low, < 0.8 → tokens-mid,
 * else tokens-high (same role mapping as context widgets via
 * `tokenRole`).
 */

import { resolveRole } from "../../theme/index.js";
import { aggregate, type ResetAxis } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { formatCount, tokenRole } from "../tokens/format.js";

export type UsageDisplay = "percent" | "bar" | "short-bar";

interface Options {
  readonly label?: string;
  readonly limit?: number;
  readonly display?: string;
  readonly barWidth?: number;
  readonly filled?: string;
  readonly empty?: string;
}

const DEFAULT_BAR_WIDTH = 12;
const DEFAULT_SHORT_BAR_WIDTH = 6;
const DEFAULT_FILLED = "█";
const DEFAULT_EMPTY = "░";

const VALID_DISPLAY: ReadonlySet<UsageDisplay> = new Set<UsageDisplay>([
  "percent",
  "bar",
  "short-bar",
]);

function resolveDisplay(value: unknown): UsageDisplay {
  if (typeof value !== "string") return "percent";
  return VALID_DISPLAY.has(value as UsageDisplay) ? (value as UsageDisplay) : "percent";
}

function clampWidth(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), 80);
}

function renderBar(ratio: number, width: number, filled: string, empty: string): string {
  const filledCount = Math.min(width, Math.max(0, Math.round(ratio * width)));
  return filled.repeat(filledCount) + empty.repeat(width - filledCount);
}

function renderUsage(
  ctx: WidgetContext,
  settings: WidgetSettings<Options>,
  axis: ResetAxis,
): Cell {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const totals = aggregate({
    events: snapshot.events,
    axis,
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    blockAnchor: snapshot.blockAnchor,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  const used = totals.total;
  const limit = typeof settings.options.limit === "number" && settings.options.limit > 0
    ? settings.options.limit
    : 0;
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  if (limit === 0) {
    return { text: `${label}${formatCount(used)}` };
  }
  const ratio = used / limit;
  const display = resolveDisplay(settings.options.display);
  const fg = resolveRole(ctx.theme, tokenRole(ratio));
  let body: string;
  if (display === "percent") {
    body = `${Math.min(999, Math.round(ratio * 100))}%`;
  } else {
    const width = clampWidth(
      settings.options.barWidth,
      display === "short-bar" ? DEFAULT_SHORT_BAR_WIDTH : DEFAULT_BAR_WIDTH,
    );
    const filled = settings.options.filled ?? DEFAULT_FILLED;
    const empty = settings.options.empty ?? DEFAULT_EMPTY;
    body = renderBar(ratio, width, filled, empty);
  }
  const cell: Cell = { text: `${label}${body}` };
  return fg ? { ...cell, fg } : cell;
}

export const sessionUsageWidget = defineWidget<Options>("session-usage", (ctx, settings) =>
  renderUsage(ctx, settings, "block"),
);

export const weeklyUsageWidget = defineWidget<Options>("weekly-usage", (ctx, settings) =>
  renderUsage(ctx, settings, "week"),
);
