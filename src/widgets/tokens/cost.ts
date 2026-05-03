/**
 * `cost` widget (§7.3). Computes USD cost from token counts × the
 * embedded pricing table (§8.5). Cost is summed per-model in the
 * window so different models in one block are priced correctly.
 */

import { aggregateCost } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatCost } from "./format.js";
import { resolveResetAxis } from "./options.js";

interface Options {
  readonly label?: string;
  readonly reset?: string;
}

export const costWidget = defineWidget<Options>("cost", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const axis = resolveResetAxis(settings.options.reset);
  const usd = aggregateCost({
    events: snapshot.events,
    axis,
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    blockAnchor: snapshot.blockAnchor,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatCost(usd)}` };
});
