/**
 * `uptime-session` and `uptime-block` widgets (§7.7).
 *
 *   - `uptime-session` — `now − ctx.tokens.sessionStart`. Hidden when
 *     no transcript snapshot is loaded yet.
 *   - `uptime-block`   — `now − blockStart(now, blockAnchor)` from
 *     the tokens module, so the boundary matches the §8.4 5-h block.
 *     Falls back to `now` (zero uptime) when the snapshot is missing.
 *
 * Both delegate duration formatting to the shared rate-limit helper
 * (`short` / `long` / `clock`) so timer-style widgets render
 * uniformly across the line.
 */

import { blockStart } from "../../tokens/index.js";
import type { Cell } from "../cell.js";
import { defineWidget } from "../widget.js";
import {
  formatDuration,
  resolveDurationFormat,
} from "../rate-limits/duration.js";

interface Options {
  readonly label?: string;
  readonly format?: string;
}

export const uptimeSessionWidget = defineWidget<Options>(
  "uptime-session",
  (ctx, settings): Cell => {
    const start = ctx.tokens?.sessionStart;
    if (start === undefined) return { text: "", hidden: true };
    const now = ctx.clock.now().getTime();
    const elapsed = Math.max(0, now - start);
    const format = resolveDurationFormat(settings.options.format, "short");
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${formatDuration(elapsed, format)}` };
  },
);

export const uptimeBlockWidget = defineWidget<Options>(
  "uptime-block",
  (ctx, settings): Cell => {
    const now = ctx.clock.now().getTime();
    const anchor = ctx.tokens?.blockAnchor;
    const start = blockStart({ now, blockAnchor: anchor });
    const elapsed = Math.max(0, now - start);
    const format = resolveDurationFormat(settings.options.format, "short");
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${formatDuration(elapsed, format)}` };
  },
);
