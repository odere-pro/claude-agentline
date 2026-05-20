/**
 * Catalogue types + the `entry` / `v` helpers used by every per-family
 * catalog file. Keeping the types in their own module lets the family
 * files (`session.ts`, `tokens.ts`, …) and `catalog.ts` itself both
 * import from one place without a circular dependency.
 *
 * The public re-exports live on `src/widgets/catalog.ts` so existing
 * imports `from "../widgets/catalog.js"` keep resolving — this file is
 * a within-catalog implementation detail.
 */

import { DEFAULT_FAMILY_IDENTITY } from "./family-identity.js";
import type { Colour } from "../../data/theme/colours/colours.js";

export { WIDGET_FAMILIES, type WidgetFamily } from "../../core/lib/widget-families.js";

import type { WidgetFamily } from "../../core/lib/widget-families.js";

/**
 * Per-family accent colour, projected from the single family-identity
 * source of truth (`family-identity.ts`). Kept as a named export so the
 * picker's existing `FAMILY_COLOR[...]` call sites keep resolving while
 * the surfaces migrate onto the richer identity API. Names are from
 * Ink's 8-colour palette so they degrade cleanly without truecolor.
 */
export const FAMILY_COLOR: Readonly<Record<WidgetFamily, Colour>> = Object.freeze(
  Object.fromEntries(
    (Object.keys(DEFAULT_FAMILY_IDENTITY) as WidgetFamily[]).map((family) => [
      family,
      DEFAULT_FAMILY_IDENTITY[family].colour,
    ]),
  ) as Record<WidgetFamily, Colour>,
);

/**
 * A *variant* is a named alternative way a single widget can render itself —
 * the same data shown differently. Skills can show a count, a list, or just
 * the last entry. Session-usage can show a percent, a long bar, or a short
 * one. The variant's `options` is a patch merged into `WidgetConfig.options`
 * when the user picks it; widgets without distinct rendering modes carry no
 * variants and the picker skips that step.
 */
export interface WidgetVariant {
  /** Stable identifier — e.g. "count", "bar", "short-bar". */
  readonly id: string;
  /** Human label for the picker. */
  readonly label: string;
  /** Patch merged into `WidgetConfig.options` on pick. */
  readonly options: Readonly<Record<string, unknown>>;
}

export interface WidgetMeta {
  /** Human label, e.g. "Git branch". */
  readonly name: string;
  /** One-line summary of what the widget renders; ≤ 80 chars. */
  readonly description: string;
  /** Source-tree family the widget belongs to. */
  readonly family: WidgetFamily;
  /**
   * Optional fixture key the picker uses to render a representative
   * preview cell. Unset means the picker resolves the cell through
   * `previewWidget` against the cached stdin (or label-mode fallback).
   */
  readonly previewFixture?: string;
  /**
   * Named alternative rendering modes for this widget. Omit (or empty) when
   * the widget has only one rendering. The editor surfaces these in step 3
   * of the picker and as the targets of the `u` (update) verb.
   */
  readonly variants?: readonly WidgetVariant[];
}

/** A catalogue entry paired with the `type` it describes. */
export type WidgetMetaEntry = WidgetMeta & { readonly type: string };

export function entry(
  name: string,
  description: string,
  family: WidgetFamily,
  variants?: readonly WidgetVariant[],
): WidgetMeta {
  if (variants !== undefined) {
    return Object.freeze({
      name,
      description,
      family,
      variants: Object.freeze(
        variants.map((variant) =>
          Object.freeze({ ...variant, options: Object.freeze({ ...variant.options }) }),
        ),
      ),
    });
  }
  return Object.freeze({ name, description, family });
}

/** Variants declared in code, by widget type. Keeps the catalogue tables compact. */
export function v(
  id: string,
  label: string,
  options: Readonly<Record<string, unknown>>,
): WidgetVariant {
  return { id, label, options };
}
