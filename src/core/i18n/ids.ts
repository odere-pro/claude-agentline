/**
 * Stable string-id namespace. Ids are dotted, lower-kebab segments so a
 * translations table (`config.translations.<lang>`) can target any
 * user-facing string without coupling to source structure:
 *
 *   widget.<type>.name            catalogue display name
 *   widget.<type>.desc            catalogue one-line description
 *   widget.<type>.variant.<id>    a variant's picker label
 *   widget.label.<slug>           a widget's default inline label
 *   family.<name>.name            widget-family display name (picker group browser)
 *   footer.<action>               a footer keybinding verb
 *   picker.<slug>                 picker chrome (titles, hints)
 *   app.<slug>                    editor chrome (status, save, warnings)
 *   cmd.<verb>.<slug>             CLI command output (doctor, install, …)
 *
 * Builders keep ids consistent across the producer (en authoring site)
 * and any consumer that wants to look one up. `I18N_NAMESPACES` is the
 * single source of truth for valid prefixes — gate-26 keys against it.
 */

/**
 * The set of valid id prefixes. Every literal id passed as the first
 * argument to `Translator` must start with one of these. Extend this
 * list when adding a new surface; `gate-26-i18n-id-namespace.sh`
 * enforces that no id slips through unregistered.
 */
export const I18N_NAMESPACES = [
  "widget.",
  "family.",
  "footer.",
  "picker.",
  "app.",
  "cmd.",
] as const;

export const widgetNameId = (type: string): string => `widget.${type}.name`;
export const widgetDescId = (type: string): string => `widget.${type}.desc`;
export const widgetVariantId = (type: string, variantId: string): string =>
  `widget.${type}.variant.${variantId}`;
export const widgetLabelId = (slug: string): string => `widget.label.${slug}`;
export const cmdId = (verb: string, slug: string): string => `cmd.${verb}.${slug}`;
