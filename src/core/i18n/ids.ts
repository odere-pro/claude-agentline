/**
 * Stable string-id namespace. Ids are dotted, lower-kebab segments so a
 * translations table (`config.translations.<lang>`) can target any
 * user-facing string without coupling to source structure:
 *
 *   widget.<type>.name            catalogue display name
 *   widget.<type>.desc            catalogue one-line description
 *   widget.<type>.variant.<id>    a variant's picker label
 *   widget.label.<slug>           a widget's default inline label
 *   footer.<action>               a footer keybinding verb
 *   picker.<slug>                 picker chrome (titles, hints)
 *   app.<slug>                    editor chrome (status, save, warnings)
 *
 * Builders keep ids consistent across the producer (en authoring site)
 * and any consumer that wants to look one up.
 */

export const widgetNameId = (type: string): string => `widget.${type}.name`;
export const widgetDescId = (type: string): string => `widget.${type}.desc`;
export const widgetVariantId = (type: string, variantId: string): string =>
  `widget.${type}.variant.${variantId}`;
export const widgetLabelId = (slug: string): string => `widget.label.${slug}`;
