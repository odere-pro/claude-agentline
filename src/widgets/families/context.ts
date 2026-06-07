/**
 * Context-window metrics — `context-percentage`, `context-200k-flag`, and
 * `context-cached`. `context-percentage` renders the current model's
 * context-window usage as a postfix (e.g. `37% · 200k`), optionally with a
 * cached segment (`showCached`); `context-200k-flag` badges a prompt that
 * has crossed the 200k-token threshold; `context-cached` shows the
 * session's cached-token count on its own cell.
 *
 * `context-length` and `context-bar` were removed in v0.1.x (PR #258).
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const CONTEXT_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  "context-percentage": entry(
    "Context %",
    "Percentage of the model's context window used",
    "context",
    [
      v("plain", "Percent + window (37% · 200k)", { showCached: false }),
      v("with-cached", "Percent + cached + window (37% · 0.8k cached · 200k)", {
        showCached: true,
      }),
    ],
  ),
  "context-200k-flag": entry(
    "200k flag",
    "Badge when the prompt exceeds the 200k-token threshold",
    "context",
  ),
  "context-cached": entry(
    "Context cached",
    "Session cached-token count (e.g. 0.8k cached)",
    "context",
  ),
});
