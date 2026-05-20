/**
 * Context-window metrics — `context-length`, `context-percentage`,
 * `context-bar`. Each renders the current model's context-window size
 * as a postfix (e.g. `200k`, `1M`).
 */

import { entry, type WidgetMeta } from "./catalog-types.js";

export const CONTEXT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "context-length": entry("Context length", "Tokens currently in the context window", "context"),
  "context-percentage": entry(
    "Context %",
    "Percentage of the model's context window used",
    "context",
  ),
  "context-bar": entry("Context bar", "Tiny inline bar approximating context fill", "context"),
});
