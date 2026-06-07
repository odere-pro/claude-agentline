/**
 * Context-window metrics — `context-percentage` and `context-200k-flag`.
 * `context-percentage` renders the current model's context-window usage
 * as a postfix (e.g. `37% · 200k`); `context-200k-flag` badges a prompt
 * that has crossed the 200k-token threshold.
 *
 * `context-length` and `context-bar` were removed in v0.1.x (PR #258).
 */

import { entry, type WidgetMeta } from "./catalog-types.js";

export const CONTEXT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "context-percentage": entry(
    "Context %",
    "Percentage of the model's context window used",
    "context",
  ),
  "context-200k-flag": entry(
    "200k flag",
    "Badge when the prompt exceeds the 200k-token threshold",
    "context",
  ),
});
