/**
 * i18n barrel. Render-safe: the loader imports config types only and
 * the id builders are pure string helpers. Nothing here reaches into
 * `src/tui/` so the render path can translate widget labels without
 * dragging the editor in (gate-19).
 */

export {
  createTranslator,
  createDictTranslator,
  identityTranslator,
  type Translator,
  type DictTranslator,
} from "./loader/loader.js";
export { EN_DICTIONARY, type DictionaryId } from "./en-dictionary.js";
export {
  I18N_NAMESPACES,
  widgetNameId,
  widgetDescId,
  widgetVariantId,
  widgetLabelId,
  cmdId,
} from "./ids.js";
