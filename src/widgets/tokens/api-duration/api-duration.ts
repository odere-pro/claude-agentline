/**
 * `api-duration` widget (tokens family).
 *
 * Renders the time spent waiting on the API, from `cost.apiDurationMs`
 * (a host scalar — no reset axis). Default presentation is absolute
 * (`2.3s`, `1m 5s`, `1h 5m`) via the shared cost-duration formatter.
 * With `options.percent`, renders the share of wall-clock
 * (`apiDurationMs ÷ totalDurationMs`) as a percent instead.
 *
 * Hides when `apiDurationMs` is absent; under percent mode also hides
 * when `totalDurationMs` is absent or 0 (no divide-by-zero). Pure
 * `(ctx, settings) → Cell`.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import { formatCostDuration } from "../format/format.js";

interface ApiDurationOptions {
  readonly label?: string;
  /** Render the share of wall-clock as a percent instead of an absolute time. */
  readonly percent?: boolean;
}

export const apiDurationWidget = defineWidget<ApiDurationOptions>(
  "api-duration",
  (ctx, settings): Cell => {
    const cost = ctx.stdin.cost;
    if (!cost || cost.apiDurationMs === undefined) return { text: "", hidden: true };

    if (settings.options.percent) {
      const wall = cost.totalDurationMs;
      if (wall === undefined || wall <= 0) return { text: "", hidden: true };
      const pct = Math.min(100, Math.round((cost.apiDurationMs / wall) * 100));
      if (settings.rawValue) return { text: String(pct) };
      const label = settings.options.label ?? "";
      return { text: `${label}${pct}%` };
    }

    const formatted = formatCostDuration(cost.apiDurationMs);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${formatted}` };
  },
);
