/**
 * Family name list — the constants-only home for `WIDGET_FAMILIES` and the
 * derived `WidgetFamily` union.
 *
 * Lives in `core/lib/` so the data layer (`data/config/types.ts`) can
 * consume the type without crossing into `widgets/` (the documented
 * `data` rule is "data imports from core only"). `widgets/catalog/types.ts`
 * re-exports both bindings to preserve its public API for downstream
 * consumers.
 */

export const WIDGET_FAMILIES = [
  "session",
  "tokens",
  "context",
  "rate-limits",
  "git",
  "other",
] as const;

export type WidgetFamily = (typeof WIDGET_FAMILIES)[number];
