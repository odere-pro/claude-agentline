/**
 * Context-window metrics — `context-percentage`. Renders the current
 * model's context-window size as a postfix (e.g. `37% · 200k`).
 *
 * `context-length` and `context-bar` were removed in v0.1.x (PR #258).
 * `context-percentage` covers the most common use-case and carries the
 * model window size postfix.
 */

import { entry, type WidgetMeta } from "./catalog-types.js";

export const CONTEXT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "context-percentage": entry(
    "Context %",
    "Percentage of the model's context window used",
    "context",
  ),
});
