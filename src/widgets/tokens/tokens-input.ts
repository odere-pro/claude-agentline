/**
 * `tokens-input` widget (§7.3). Sums `message.usage.input_tokens` from
 * the JSONL transcript filtered by the configured reset axis.
 */

import { aggregate } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatCount } from "./format.js";
import { resolveResetAxis } from "./options.js";

interface Options {
  readonly label?: string;
  readonly reset?: string;
}

export const tokensInputWidget = defineWidget<Options>("tokens-input", (ctx, settings) => {
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
  return { text: `${label}${formatCount(totals.input)}` };
});
