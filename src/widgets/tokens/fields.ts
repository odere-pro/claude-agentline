/**
 * Token-count widgets (§7.3): the merged `tokens` widget and the
 * standalone `tokens-cached` subtotal.
 *
 * `tokens` renders the input and output subtotals together as
 * `↓<input> ↑<output>` (arrow before value, single-space separator),
 * mirroring the `git-ahead-behind` convention. `tokens-cached` keeps
 * the single-field factory since it formats one field unchanged.
 * Both aggregate along the configured reset axis (§7.3 requires
 * token widgets declare a reset axis).
 */

import { aggregate, type TokenTotals, type TokensSnapshot } from "../../data/tokens/index.js";
import type { WidgetContext } from "../types.js";
import { defineWidget } from "../widget.js";
import type { WidgetDef } from "../widget.js";

import { formatCount } from "./format.js";
import { resolveGlyphs, resolveResetAxis } from "./options.js";

type TotalsField = "input" | "output" | "cached";

interface Options {
  readonly label?: string;
  readonly reset?: string;
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

function defineTokensFieldWidget(type: string, field: TotalsField): WidgetDef<Options> {
  return defineWidget<Options>(type, (ctx, settings) => {
    const snapshot = ctx.tokens;
    if (!snapshot) return { text: "", hidden: true };
    const totals = aggregateFor(snapshot, ctx, settings.options.reset);
    const label = settings.rawValue ? "" : (settings.options.label ?? "");
    return { text: `${label}${formatCount(totals[field])}` };
  });
}

export const tokensCachedWidget = defineTokensFieldWidget("tokens-cached", "cached");

export const tokensWidget = defineWidget<TokensOptions>("tokens", (ctx, settings) => {
  const snapshot = ctx.tokens;
  if (!snapshot) return { text: "", hidden: true };
  const totals = aggregateFor(snapshot, ctx, settings.options.reset);
  const { inGlyph, outGlyph } = resolveGlyphs(settings.options);
  const body = `${inGlyph}${formatCount(totals.input)} ${outGlyph}${formatCount(totals.output)}`;
  const label = settings.rawValue ? "" : (settings.options.label ?? "");
  return { text: `${label}${body}` };
});
