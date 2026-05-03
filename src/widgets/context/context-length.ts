/**
 * `context-length` widget (§7.4). Raw used-token count across the
 * current session — what's actively pinned to the conversation
 * context, not the lifetime sum. Reads from `ctx.tokens.events`
 * filtered to `sessionStart`.
 */

import { aggregate } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import { formatCount } from "../tokens/format.js";

interface Options {
  readonly label?: string;
}

export const contextLengthWidget = defineWidget<Options>("context-length", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const totals = aggregate({
    events: snapshot.events,
    axis: "session",
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${formatCount(totals.input + totals.cached)}` };
});
