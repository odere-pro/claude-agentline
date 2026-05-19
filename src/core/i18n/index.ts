/**
 * i18n barrel. Render-safe: the loader imports config types only and
 * the id builders are pure string helpers. Nothing here reaches into
 * `src/tui/` so the render path can translate widget labels without
 * dragging the editor in (gate-19).
 */

export { createTranslator, identityTranslator, type Translator } from "./loader.js";
export { widgetNameId, widgetDescId, widgetVariantId, widgetLabelId } from "./ids.js";
