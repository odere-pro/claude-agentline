/**
 * `cost-usd` widget (tokens family, §7.3).
 *
 * Renders the host-reported session cost in USD, e.g. `$1.23`.
 * Reads `ctx.stdin.cost.totalUsd` directly — the host pre-computes
 * this scalar; no transcript aggregation, no reset axis.
 *
 * Hides when `cost` or `totalUsd` is absent.
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import { formatUsd } from "../format/format.js";

interface CostUsdOptions {
  readonly label?: string;
}

export const costUsdWidget = defineWidget<CostUsdOptions>("cost-usd", (ctx, settings): Cell => {
  const cost = ctx.stdin.cost;
  if (!cost || cost.totalUsd === undefined) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatUsd(cost.totalUsd)}` };
});
