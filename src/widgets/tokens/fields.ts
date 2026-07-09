/**
 * Token-count widgets (§7.3): the merged `tokens` widget and the
 * standalone `tokens-cached` gauge.
 *
 * `tokens` renders the input and output subtotals together as
 * `↓<input> ↑<output>` (arrow before value, single-space separator),
 * mirroring the `git-ahead-behind` convention. It aggregates along the
 * configured reset axis (§7.3 requires token *accumulators* declare one).
 *
 * `tokens-cached` is deliberately **not** an accumulator, and so declares
 * no reset axis (issue #306). It reads the host's
 * `context_window.current_usage` cache figures: the cached portion of the
 * prompt right now. Summing per-turn cache reads across a window — what it
 * used to do — is meaningless, because every turn re-reads essentially the
 * whole cache: a real 484-turn session summed to 163M against a true cached
 * context of 322k. It also read the live transcript while its neighbour
 * `context-percentage` read the frozen payload, so one statusline reported
 * cache two incompatible ways. Both now read the payload.
 */

import { aggregate, type TokenTotals, type TokensSnapshot } from "../../data/tokens/index.js";
import { joinValues } from "../separator/separator.js";
import type { WidgetContext } from "../types.js";
import { defineWidget } from "../widget.js";
import type { WidgetDef } from "../widget.js";

import { formatCount } from "./format/format.js";
import { resolveGlyphs, resolveResetAxis } from "./options/options.js";

interface Options {
  readonly label?: string;
  readonly reset?: string;
}

/** `tokens-cached` takes no reset axis — it is a point-in-time gauge. */
interface CachedOptions {
  readonly label?: string;
}

interface TokensOptions extends Options {
  readonly inputGlyph?: string;
  readonly outputGlyph?: string;
}

function aggregateFor(
  snapshot: TokensSnapshot,
  ctx: WidgetContext,
  reset: string | undefined,
): TokenTotals {
  return aggregate({
    events: snapshot.events,
    axis: resolveResetAxis(reset),
    now: snapshot.now,
    sessionStart: snapshot.sessionStart,
    blockAnchor: snapshot.blockAnchor,
    model: ctx.stdin.model,
    effort: ctx.stdin.thinkingEffort,
  });
}

export const tokensCachedWidget: WidgetDef<CachedOptions> = defineWidget<CachedOptions>(
  "tokens-cached",
  (ctx, settings) => {
    const cached = ctx.stdin.contextWindow?.cachedTokens;
    if (cached === undefined) return { text: "", hidden: true };
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${formatCount(cached)}` };
  },
);

export const tokensWidget = defineWidget<TokensOptions>("tokens", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const totals = aggregateFor(snapshot, ctx, settings.options.reset);
  const { inGlyph, outGlyph } = resolveGlyphs(settings.options);
  const body = joinValues(ctx, [
    `${inGlyph}${formatCount(totals.input)}`,
    `${outGlyph}${formatCount(totals.output)}`,
  ]);
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${body}` };
});
