/**
 * Widget catalogue — human-readable metadata for every built-in widget.
 *
 * The render-path contract (`WidgetDef = { type, render }`) stays minimal:
 * the renderer never needs a widget's display name. Metadata lives here, in
 * one auditable place, keyed by the same `type` string the registry uses.
 * `family` mirrors the source-tree family (`src/widgets/<family>/`).
 *
 * The catalogue is split across `src/widgets/catalog/<family>.ts` files
 * (one per `WIDGET_FAMILIES` entry); this module composes them into
 * `WIDGET_CATALOG` and exports the lookup helpers. Types and the small
 * `entry` / `v` builders live in `./catalog/types.ts` so each family file
 * can pull from one place without a circular dependency on the
 * composition root.
 *
 * Invariants (enforced by `catalog.test.ts`):
 *   - every built-in registered type has exactly one entry here;
 *   - no entry names a type that is not a built-in;
 *   - every `description` is non-empty and ≤ 80 characters;
 *   - every `family` is one of `WIDGET_FAMILIES`.
 */

import { CONTEXT_CATALOG } from "./catalog/context.js";
import { CUSTOM_CATALOG } from "./catalog/custom.js";
import { GIT_CATALOG } from "./catalog/git.js";
import { RATE_LIMITS_CATALOG } from "./catalog/rate-limits.js";
import { SESSION_CATALOG } from "./catalog/session.js";
import { TIME_CATALOG } from "./catalog/time.js";
import { TOKENS_CATALOG } from "./catalog/tokens.js";
import type { WidgetMeta, WidgetVariant } from "./catalog/types.js";

export {
  FAMILY_COLOR,
  WIDGET_FAMILIES,
  type WidgetFamily,
  type WidgetMeta,
  type WidgetMetaEntry,
  type WidgetVariant,
} from "./catalog/types.js";

/** Canonical metadata for every built-in widget, keyed by `type`. */
export const WIDGET_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  ...SESSION_CATALOG,
  ...TOKENS_CATALOG,
  ...CONTEXT_CATALOG,
  ...RATE_LIMITS_CATALOG,
  ...GIT_CATALOG,
  ...TIME_CATALOG,
  ...CUSTOM_CATALOG,
});

/** Look up a widget's metadata by `type`. */
export function widgetMeta(type: string): WidgetMeta | undefined {
  return WIDGET_CATALOG[type];
}

/** Variants for `type`, or an empty list when the widget has no variants. */
export function widgetVariants(type: string): readonly WidgetVariant[] {
  return WIDGET_CATALOG[type]?.variants ?? [];
}

/**
 * Best-guess "which variant am I currently on?" given the widget's `options`.
 * Match is by full-equality on every key the variant declares; partial matches
 * (variant declares `{display:"bar"}`, current options is
 * `{display:"bar", barWidth:8}`) still match. Returns `null` when no variant
 * fits — e.g. options has been hand-edited away from any catalogued shape.
 */
export function activeVariantId(
  type: string,
  options: Readonly<Record<string, unknown>> | undefined,
): string | null {
  const variants = widgetVariants(type);
  if (variants.length === 0) return null;
  const opts = options ?? {};
  for (const variant of variants) {
    let match = true;
    for (const [key, value] of Object.entries(variant.options)) {
      if ((opts as Record<string, unknown>)[key] !== value) {
        match = false;
        break;
      }
    }
    if (match) return variant.id;
  }
  return null;
}
