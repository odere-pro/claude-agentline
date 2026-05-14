/**
 * Per-field token-count widgets (§7.3): `tokens-input`, `tokens-output`,
 * `tokens-cached`, and `tokens-total`.
 *
 * Every widget here shares the same render pipeline — aggregate along the
 * configured reset axis, then format one field of the resulting totals.
 * The four widgets used to live in four files differing only by the
 * field selector; a single factory removes the duplication.
 */

import { aggregate } from "../../tokens/index.js";
import { defineWidget } from "../widget.js";
import type { WidgetDef } from "../widget.js";

import { formatCount } from "./format.js";
import { resolveResetAxis } from "./options.js";

type TotalsField = "input" | "output" | "cached" | "total";

interface Options {
  readonly label?: string;
  readonly reset?: string;
}

function defineTokensFieldWidget(
  type: string,
  field: TotalsField,
): WidgetDef<Options> {
  return defineWidget<Options>(type, (ctx, settings) => {
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
    return { text: `${label}${formatCount(totals[field])}` };
  });
}

export const tokensInputWidget = defineTokensFieldWidget("tokens-input", "input");
export const tokensOutputWidget = defineTokensFieldWidget("tokens-output", "output");
export const tokensCachedWidget = defineTokensFieldWidget("tokens-cached", "cached");
export const tokensTotalWidget = defineTokensFieldWidget("tokens-total", "total");
