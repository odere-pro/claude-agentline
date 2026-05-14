/**
 * Layout-shaping widgets — `separator`, `osc-link`. These don't surface
 * runtime signals; they exist so the user can stylise the statusline
 * structure itself.
 */

import { entry, type WidgetMeta } from "./types.js";

export const CUSTOM_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  separator: entry("Separator", "A single user-defined glyph (options.char)", "custom"),
  "osc-link": entry(
    "OSC 8 link",
    "Clickable hyperlink (options.url, options.label)",
    "custom",
  ),
});
