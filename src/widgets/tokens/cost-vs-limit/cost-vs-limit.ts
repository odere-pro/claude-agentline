/**
 * `cost-vs-limit` widget (tokens family).
 *
 * Shows session spend against a user-configured budget, e.g. `$1.20/$5`.
 * Reads `cost.totalUsd` (host scalar — no reset axis) and a per-widget
 * `budget` option (USD, a positive number). When spend reaches or exceeds
 * the budget the cell signals with the theme's `danger` role (theme-driven
 * — no hardcoded colour), so over-budget reads as a state, not an accent.
 *
 * Hides when `totalUsd` is absent, or `budget` is missing / non-positive /
 * not a finite number. Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import { formatUsd } from "../format/format.js";
import { resolveRole } from "../../../data/theme/index.js";

interface CostVsLimitOptions {
  readonly label?: string;
  /** Budget ceiling in USD; a positive number. Required (hides without it). */
  readonly budget?: number;
}

export const costVsLimitWidget = defineWidget<CostVsLimitOptions>(
  "cost-vs-limit",
  (ctx, settings): Cell => {
    const cost = ctx.stdin.cost;
    if (!cost || cost.totalUsd === undefined) return { text: "", hidden: true };
    const budget = settings.options.budget;
    if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) {
      return { text: "", hidden: true };
    }

    const spend = cost.totalUsd;
    const text = `${formatUsd(spend)}/${formatUsd(budget)}`;
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const overBudget = spend >= budget;

    if (overBudget) {
      return { text: `${label}${text}`, fg: resolveRole(ctx.theme, "danger"), signal: true };
    }
    return { text: `${label}${text}` };
  },
);
