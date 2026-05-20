/**
 * Widget picker overlay — four views, one per picker mode in the reducer:
 *
 *   `picker-group`   → `PickerGroup`   — browse widget families ("session",
 *                      "git", …) with per-family counts; the default
 *                      view when the picker opens. `/` switches to the
 *                      flat search view.
 *   `picker-widget`  → `PickerWidget`  — after selecting a family,
 *                      the in-family widget list with a live filter and
 *                      per-row mini-preview.
 *   `picker-search`  → `PickerSearch`  — flat, searchable list across
 *                      every catalogued widget; each row carries a family
 *                      badge. Already-placed widgets are hidden via
 *                      `exclude` in every view.
 *   `picker-variant` → `PickerVariant` — pick a variant for widgets that
 *                      have them; skipped otherwise.
 *
 * Each component lives in its own `picker-<step>.ts` module and is a thin
 * Ink projection over the helpers in `picker-helpers.ts`; this file is a
 * barrel preserving the existing public surface so `from "./picker.js"`
 * keeps resolving for `app.ts`, `editor-input-handlers.ts`, and tests.
 */

export {
  PICKER_PAGE,
  clampIndex,
  familiesWithWidgets,
  familyAccent,
  filterWidgets,
  previewForVariant,
  selectedAt,
  variantRows,
  widgetsInFamily,
  windowSlice,
  wrapIndex,
  type PickerBasis,
  type VariantRow,
} from "./picker-helpers.js";
export { PickerGroup, type PickerGroupProps } from "./picker-group.js";
export { PickerWidget, type PickerWidgetProps } from "./picker-widget.js";
export { PickerSearch, type PickerSearchProps } from "./picker-search.js";
export { PickerVariant, type PickerVariantProps } from "./picker-variant.js";
