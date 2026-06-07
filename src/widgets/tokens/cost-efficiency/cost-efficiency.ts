/**
 * `cost-efficiency` widget (tokens family).
 *
 * Renders the API-active ratio `apiDurationMs ÷ totalDurationMs` as a
 * percent — how much of the wall-clock the session spent in API calls
 * vs. local work. Both scalars are host-provided, so there is no reset
 * axis (like `cost-usd`).
 *
 * Hides when either field is absent or `totalDurationMs` is 0 (no
 * divide-by-zero). The ratio is capped at 100% so a host that reports
 * api time slightly above wall time never reads `101%`. Pure
 * `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";

interface CostEfficiencyOptions {
  readonly label?: string;
}

export const costEfficiencyWidget = defineWidget<CostEfficiencyOptions>(
  "cost-efficiency",
  (ctx, settings): Cell => {
    const cost = ctx.stdin.cost;
    if (!cost || cost.apiDurationMs === undefined || cost.totalDurationMs === undefined) {
      return { text: "", hidden: true };
    }
    if (cost.totalDurationMs <= 0) return { text: "", hidden: true };
    const pct = Math.min(100, Math.round((cost.apiDurationMs / cost.totalDurationMs) * 100));
    if (settings.rawValue) return { text: String(pct) };
    const label = settings.options.label ?? "";
    return { text: `${label}${pct}%` };
  },
);
