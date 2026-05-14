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

export const WIDGET_CATEGORIES = [
  "session",
  "tokens",
  "context",
  "rate-limits",
  "git",
  "time",
  "custom",
] as const;

export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number];

/**
 * Per-category accent colour. The editor uses this in two surfaces that
 * have to agree visually — the picker's group label and the inline preview
 * widget chips — so a user scanning the layout can tell which group every
 * widget belongs to without reading the type name. Names are from Ink's
 * 8-colour palette so they degrade cleanly on hosts without truecolor.
 *
 * This is a decorative, editor-only mapping: the real render path through
 * `pipeline.ts` keeps using the configured theme's roles.
 */
export const CATEGORY_COLOR: Readonly<Record<WidgetCategory, string>> = Object.freeze({
  session: "blue",
  tokens: "yellow",
  context: "magenta",
  "rate-limits": "red",
  git: "green",
  time: "cyan",
  custom: "white",
});

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
  readonly category: WidgetCategory;
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
  /**
   * Single grapheme prepended to the widget's text when
   * `config.glyphs === "nerd-font"`. Codepoints come from the Nerd Font
   * Private Use Area (PUA) — they only render correctly with a Nerd Font
   * installed in the user's terminal, which is why glyph mode is opt-in.
   * Widgets without a glyph are unaffected by the mode toggle.
   */
  readonly glyph?: string;
}

/** A catalogue entry paired with the `type` it describes. */
export type WidgetMetaEntry = WidgetMeta & { readonly type: string };

export function entry(
  name: string,
  description: string,
  category: WidgetCategory,
  variants?: readonly WidgetVariant[],
): WidgetMeta {
  if (variants !== undefined) {
    return Object.freeze({
      name,
      description,
      category,
      variants: Object.freeze(
        variants.map((variant) =>
          Object.freeze({ ...variant, options: Object.freeze({ ...variant.options }) }),
        ),
      ),
    });
  }
  return Object.freeze({ name, description, category });
}

/** Variants declared in code, by widget type. Keeps the catalogue tables compact. */
export function v(
  id: string,
  label: string,
  options: Readonly<Record<string, unknown>>,
): WidgetVariant {
  return { id, label, options };
}
