/**
 * Context-window metrics — `context-length`, `context-percentage`,
 * `context-percentage-usable`, `context-bar`.
 */

import { entry, type WidgetMeta } from "./types.js";

export const CONTEXT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "context-length": entry("Context length", "Tokens currently in the context window", "context"),
  "context-percentage": entry(
    "Context %",
    "Percentage of the model's context window in use",
    "context",
  ),
  "context-percentage-usable": entry(
    "Context % (usable)",
    "Percentage of usable context in use (excludes output budget)",
    "context",
  ),
  "context-bar": entry("Context bar", "Tiny inline bar approximating context fill", "context"),
});
