/**
 * Session + weekly usage widget (§7.5) — the host's `/usage` numbers on
 * one cell, not a re-derived estimate. Reads the `rate_limits` block off
 * Claude Code stdin so the percentages match the host's `/usage` screen
 * — what the user sees in Claude Code:
 *
 *   - current-session — `rate_limits.five_hour.used_percentage`
 *   - weekly          — `rate_limits.seven_day.used_percentage`
 *
 * Renders both windows together as `52% / weekly 33%`. Each part is
 * included only when the host ships a finite percentage for it:
 *
 *   - both present   `52% / weekly 33%`
 *   - session only   `52%`
 *   - weekly only    `weekly 33%`
 *   - neither         hidden
 *
 * There is no transcript-derived fallback: it over-counts and would
 * disagree with the host, so an absent window simply drops its half.
 *
 * An optional plan name is prefixed when present: a future `raw.plan`
 * string the host may ship, else the configured `options.plan`. Out of
 * the box there is no prefix, so it renders exactly `52% / weekly 33%`.
 * `rawValue` strips the label/plan prefix like the other rate-limits
 * widgets.
 *
 * Renders in the rate-limits family accent — no per-widget colour, so
 * every rate-limits widget reads as one family.
 */

import type { Cell } from "../cell.js";
import type { WidgetContext } from "../context.js";
import { joinValues } from "../separator.js";
import type { WidgetSettings } from "../widget.js";
import { defineWidget } from "../widget.js";

interface Options {
  readonly label?: string;
  /** Plan-name prefix (e.g. `"Max"`). Rendered as `Max 52% / weekly 33%`. */
  readonly plan?: string;
}

const MAX_PERCENT = 999;
const WEEKLY_PREFIX = "weekly ";

/** Round + clamp a host percentage into a `NN%` string, or `null` when absent. */
function formatPercent(pct: unknown): string | null {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  return `${Math.min(MAX_PERCENT, Math.max(0, Math.round(pct)))}%`;
}

/**
 * Plan-name prefix: a future host-provided `raw.plan` string wins, then
 * the configured `options.plan`, else none. Returns `""` when neither is
 * a non-empty string so the widget renders bare (matches the host).
 */
function resolvePlan(ctx: WidgetContext, options: Options): string {
  const rawPlan = ctx.stdin.raw["plan"];
  if (typeof rawPlan === "string" && rawPlan.trim().length > 0) return rawPlan.trim();
  const opt = options.plan;
  return typeof opt === "string" && opt.trim().length > 0 ? opt.trim() : "";
}

function renderUsage(ctx: WidgetContext, settings: WidgetSettings<Options>): Cell {
  const limits = ctx.stdin.rateLimits;
  const session = formatPercent(limits?.fiveHour?.usedPercentage);
  const weekly = formatPercent(limits?.sevenDay?.usedPercentage);
  if (session === null && weekly === null) {
    return { text: "", hidden: true };
  }

  const parts: string[] = [];
  if (session !== null) parts.push(session);
  if (weekly !== null) parts.push(`${WEEKLY_PREFIX}${weekly}`);
  const body = joinValues(ctx, parts);

  if (settings.rawValue) return { text: body };
  const label = settings.options.label ?? "";
  const plan = resolvePlan(ctx, settings.options);
  const planPart = plan ? `${plan} ` : "";
  return { text: `${label}${planPart}${body}` };
}

export const sessionWeeklyUsageWidget = defineWidget<Options>(
  "session-weekly-usage",
  (ctx, settings) => renderUsage(ctx, settings),
);
