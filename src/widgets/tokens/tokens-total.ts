/**
 * `tokens-total` widget (§7.3). Sum of input + output + cached along
 * the configured reset axis.
 */

import { aggregate } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatCount } from "./format.js";
import { resolveResetAxis } from "./options.js";

interface Options {
  readonly label?: string;
  readonly reset?: string;
}

export const tokensTotalWidget = defineWidget<Options>("tokens-total", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const axis = resolveResetAxis(settings.options.reset);
  const totals = aggregate({
    events: snapshot.events,
    axis,
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    blockAnchor: snapshot.blockAnchor,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatCount(totals.total)}` };
});
