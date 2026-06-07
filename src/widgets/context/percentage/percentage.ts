/**
 * `context-percentage` widget (§7.4). Used / window ratio, followed by
 * the model's context-window size (e.g. `37% · 200k`). With
 * `options.showCached`, an extra cached-token segment is inserted
 * (`37% · 0.8k cached · 200k`). `showCached` is OFF by default so the
 * common render — and the goldens — stay byte-stable. Renders in the
 * context family accent — no per-widget colour.
 *
 * The `{ used, window }` and cached-token resolution live in `../usage.ts`.
 */

import type { Cell } from "../../cell/cell.js";
import { valueSeparator } from "../../separator/separator.js";
import { MAX_DISPLAY_PERCENTAGE } from "../../types.js";
import { defineWidget } from "../../widget.js";
import { formatCount } from "../../tokens/format/format.js";

import { formatWindowLabel, resolveCachedTokens, resolveContextUsage } from "../usage.js";

interface Options {
  readonly label?: string;
  /** Insert a `<n> cached` segment before the window size. Off by default. */
  readonly showCached?: boolean;
}

export const contextPercentageWidget = defineWidget<Options>(
  "context-percentage",
  (ctx, settings): Cell => {
    const usage = resolveContextUsage(ctx);
    if (usage === null) return { text: "", hidden: true };
    const ratio = usage.window > 0 ? usage.used / usage.window : 0;
    const pct = Math.min(MAX_DISPLAY_PERCENTAGE, Math.round(ratio * 100));
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    const sep = valueSeparator(ctx);

    const segments: string[] = [];
    if (settings.options.showCached === true) {
      const cached = resolveCachedTokens(ctx);
      if (cached !== null) segments.push(`${formatCount(cached)} cached`);
    }
    const windowLabel = formatWindowLabel(usage.window);
    if (windowLabel) segments.push(windowLabel);

    const postfix = segments.length > 0 ? ` ${sep} ${segments.join(` ${sep} `)}` : "";
    return { text: `${label}${pct}%${postfix}` };
  },
);
