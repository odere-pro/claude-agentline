/**
 * `context-length` widget (§7.4). The current context-window occupancy —
 * what is actively pinned to the conversation right now — followed by the
 * model's context-window size (e.g. `180k / 1M`).
 *
 * Shares its source of truth with `context-percentage`: it defers to
 * {@link resolveContextUsage}, which prefers Claude Code's `context_window`
 * snapshot (so the figure agrees with the host's own "N% used" and is
 * meaningful for deciding when to `/clear` or `/compact`), falling back to
 * the transcript-derived snapshot only for older hosts.
 */

import { valueSeparator } from "../separator.js";
import { defineWidget } from "../widget.js";
import { formatCount } from "../tokens/format.js";

import { formatWindowLabel, resolveContextUsage } from "./usage.js";

interface Options {
  readonly label?: string;
}

export const contextLengthWidget = defineWidget<Options>("context-length", (ctx, settings) => {
  const usage = resolveContextUsage(ctx);
  if (usage === null) return { text: "", hidden: true };
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const windowLabel = formatWindowLabel(usage.window);
  const postfix = windowLabel ? ` ${valueSeparator(ctx)} ${windowLabel}` : "";
  return { text: `${label}${formatCount(usage.used)}${postfix}` };
});
