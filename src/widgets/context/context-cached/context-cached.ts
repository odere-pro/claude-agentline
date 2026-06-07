/**
 * `context-cached` widget (context family) — the session's cached-token
 * count, e.g. `0.8k cached`. Parallel to `tokens-cached`, but lives in the
 * context family because it answers "how much of my context is served from
 * cache". Reads the same cached source as `context-percentage`'s
 * `showCached` postfix (`resolveCachedTokens` in `../usage.ts`).
 *
 * Hides when there is no token snapshot or the session has no cached
 * tokens. Pure `(ctx, settings) → Cell`; no reset axis (it's the session
 * total, like the live context figures).
 */

import type { Cell } from "../../cell/cell.js";
import { defineWidget } from "../../widget.js";
import { formatCount } from "../../tokens/format/format.js";
import { resolveCachedTokens } from "../usage.js";

interface Options {
  readonly label?: string;
}

export const contextCachedWidget = defineWidget<Options>(
  "context-cached",
  (ctx, settings): Cell => {
    const cached = resolveCachedTokens(ctx);
    if (cached === null) return { text: "", hidden: true };
    if (settings.rawValue) return { text: formatCount(cached) };
    const label = settings.options.label ?? "";
    return { text: `${label}${formatCount(cached)} cached` };
  },
);
