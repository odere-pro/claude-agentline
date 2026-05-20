/**
 * Translator: resolve a user-facing string by stable id, with the
 * built-in English text passed alongside as the authored source /
 * fallback. A `config.translations[language][id]` entry overrides it;
 * otherwise the English string is returned verbatim. `{name}`-style
 * placeholders are interpolated from `vars`.
 *
 * Render-safe by construction: imports config *types* only, does no
 * I/O, allocates nothing on the hot path beyond the resolved string.
 * The English text lives at each call site (single authoring point),
 * so there is no parallel en table to drift; the id is the stable key
 * a locale table is keyed by.
 */

import type { AgentlineConfig } from "../../../data/config/types.js";

import { EN_DICTIONARY, type DictionaryId } from "../en-dictionary.js";

export type TranslateVars = Readonly<Record<string, string | number>>;

export type Translator = (id: string, en: string, vars?: TranslateVars) => string;

/**
 * Dictionary-bound translator: the English text is sourced from
 * `EN_DICTIONARY` keyed by id, so call sites pass only `(id, vars?)`.
 * `keyof typeof EN_DICTIONARY` lets TypeScript catch typos at compile
 * time; gate-26 catches them at lint time for any code that falls back
 * to a string-typed id.
 */
export type DictTranslator = (id: DictionaryId, vars?: TranslateVars) => string;

function interpolate(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole,
  );
}

/** English passthrough — used when no language/translations are configured. */
export const identityTranslator: Translator = (_id, en, vars) => interpolate(en, vars);

/**
 * Build a translator bound to the config's language + translations
 * table. Falls back to the authored English for any id the active
 * locale doesn't define, so a partial translation never blanks the UI.
 */
export function createTranslator(
  config: Partial<Pick<AgentlineConfig, "language" | "translations">>,
): Translator {
  const lang = config.language ?? "en";
  const table = config.translations?.[lang];
  if (lang === "en" || !table) return identityTranslator;
  return (id, en, vars) => interpolate(table[id] ?? en, vars);
}

/**
 * Build a `DictTranslator` bound to `config` and the project-wide
 * English dictionary. Call sites use this for every static-id surface
 * (app/picker/footer/family/cmd chrome); only catalogue-driven widget
 * strings and the rare template-literal id stay on the underlying
 * `Translator`.
 */
export function createDictTranslator(
  config: Partial<Pick<AgentlineConfig, "language" | "translations">>,
): DictTranslator {
  const t = createTranslator(config);
  return (id, vars) => t(id, EN_DICTIONARY[id], vars);
}
