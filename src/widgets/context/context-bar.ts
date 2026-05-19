/**
 * `context-bar` widget (§7.4). Renders a fixed-width bar (default 12)
 * showing the used / window ratio, followed by the model's
 * context-window size (e.g. `████░░░░ 200k`).
 *
 * The bar carries no state-signal colour: it returns a plain cell so
 * the render pipeline paints it with the `context` family accent
 * (`config.families.context.colour`), keeping it consistent with every
 * other surface that shows the family.
 *
 * The `{ used, window }` resolution lives in `./usage.ts` and is shared
 * with `context-percentage`.
 */

import { defineWidget } from "../widget.js";
import { clampWidth } from "../tokens/format.js";

import { formatWindowLabel, resolveContextUsage } from "./usage.js";

interface Options {
  readonly label?: string;
  readonly width?: number;
  readonly filled?: string;
  readonly empty?: string;
}

const DEFAULT_WIDTH = 12;
const DEFAULT_FILLED = "█";
const DEFAULT_EMPTY = "░";

export const contextBarWidget = defineWidget<Options>("context-bar", (ctx, settings) => {
  const usage = resolveContextUsage(ctx);
  if (usage === null || usage.window <= 0) return { text: "", hidden: true };
  const ratio = Math.min(1, usage.used / usage.window);
  const width = clampWidth(settings.options.width, DEFAULT_WIDTH);
  const filledChar = settings.options.filled ?? DEFAULT_FILLED;
  const emptyChar = settings.options.empty ?? DEFAULT_EMPTY;
  const filledCount = Math.min(width, Math.max(0, Math.round(ratio * width)));
  const bar = filledChar.repeat(filledCount) + emptyChar.repeat(width - filledCount);
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  const windowLabel = formatWindowLabel(usage.window);
  const postfix = windowLabel ? ` ${windowLabel}` : "";
  return { text: `${label}${bar}${postfix}` };
});
