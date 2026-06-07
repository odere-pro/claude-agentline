/**
 * `cost-burn-rate` widget (tokens family).
 *
 * Derives a spend rate from the host cost block:
 *   $/hr = totalUsd ÷ (totalDurationMs / 3.6e6).
 * The host pre-computes both scalars, so there is no transcript
 * aggregation and no reset axis (like `cost-usd`).
 *
 * Hides when `totalUsd` or `totalDurationMs` is absent, or when
 * `totalDurationMs` is 0 (no divide-by-zero — a fresh session with no
 * elapsed time has no meaningful rate yet). Pure `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import { formatUsd } from "../format/format.js";

interface CostBurnRateOptions {
  readonly label?: string;
}

const HOUR_MS = 3_600_000;

export const costBurnRateWidget = defineWidget<CostBurnRateOptions>(
  "cost-burn-rate",
  (ctx, settings): Cell => {
    const cost = ctx.stdin.cost;
    if (!cost || cost.totalUsd === undefined || cost.totalDurationMs === undefined) {
      return { text: "", hidden: true };
    }
    if (cost.totalDurationMs <= 0) return { text: "", hidden: true };
    const ratePerHour = cost.totalUsd / (cost.totalDurationMs / HOUR_MS);
    const formatted = formatUsd(ratePerHour);
    if (settings.rawValue) return { text: formatted };
    const label = settings.options.label ?? "";
    return { text: `${label}${formatted}/hr` };
  },
);
