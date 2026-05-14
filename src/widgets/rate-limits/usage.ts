/**
 * Usage widgets (§7.5).
 *
 *   - `session-usage`       — block-axis total
 *   - `weekly-sonnet-usage` — week-axis total filtered to Sonnet events
 *   - `weekly-opus-usage`   — week-axis total filtered to Opus events
 *
 * Display is cycled by the TUI via `options.display`:
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
 *
 * The per-model weekly widgets compose two filters: events are
 * narrowed to a model family via `eventFilter` (a plain predicate on
 * `TranscriptEvent`) **before** the week-axis aggregator runs. The
 * aggregator stays single-axis — combining axes happens at the call
 * site so the shared aggregator does not learn about model families.
 */

import { resolveRole } from "../../theme/index.js";
import { aggregate, type ResetAxis } from "../../tokens/index.js";
import type { TranscriptEvent } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";
import { clampWidth, formatCount, tokenRole } from "../tokens/format.js";

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

function renderBar(ratio: number, width: number, filled: string, empty: string): string {
  const filledCount = Math.min(width, Math.max(0, Math.round(ratio * width)));
  return filled.repeat(filledCount) + empty.repeat(width - filledCount);
}

function renderUsage(
  ctx: WidgetContext,
  settings: WidgetSettings<Options>,
  axis: ResetAxis,
  eventFilter?: (ev: TranscriptEvent) => boolean,
): Cell {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const events = eventFilter ? snapshot.events.filter(eventFilter) : snapshot.events;
  const totals = aggregate({
    events,
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

/**
 * Match a model family by id prefix. Mirrors the classification in
 * `src/tokens/pricing.ts` (`startsWith("claude-sonnet")` etc.) so the
 * usage widgets and pricing always agree on what counts as which
 * family. An event whose `model` is undefined is skipped — we can't
 * attribute usage to a family without a tag.
 */
function isModelFamily(ev: TranscriptEvent, family: string): boolean {
  return typeof ev.model === "string" && ev.model.startsWith(family);
}

export const sessionUsageWidget = defineWidget<Options>("session-usage", (ctx, settings) =>
  renderUsage(ctx, settings, "block"),
);

export const weeklySonnetUsageWidget = defineWidget<Options>(
  "weekly-sonnet-usage",
  (ctx, settings) => renderUsage(ctx, settings, "week", (ev) => isModelFamily(ev, "claude-sonnet")),
);

export const weeklyOpusUsageWidget = defineWidget<Options>(
  "weekly-opus-usage",
  (ctx, settings) => renderUsage(ctx, settings, "week", (ev) => isModelFamily(ev, "claude-opus")),
);
