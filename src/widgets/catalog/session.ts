/**
 * Identity + per-session signals — `model`, `version`, `thinking-effort`,
 * `skills`, `session-id`, `session-name`, `account-email`.
 */

import { entry, v, type WidgetMeta } from "./types.js";

export const SESSION_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  model: entry("Model", "Active model id (e.g. Sonnet 4.6)", "session"),
  version: entry("Version", "Claude Code version", "session"),
  "thinking-effort": entry(
    "Thinking effort",
    "Thinking-effort tier: low, medium, or high",
    "session",
  ),
  skills: entry("Skills", "Skills attached to the session", "session", [
    v("count", "Count (just the number)", { variant: "count" }),
    v("list", "List (comma-joined)", { variant: "list" }),
    v("last", "Last (most recent only)", { variant: "last" }),
  ]),
  "session-id": entry("Session id", "Short session id", "session"),
  "session-name": entry("Session name", "Session name, or the short id when unset", "session"),
  "account-email": entry("Account email", "Logged-in account email", "session", [
    v("full", "Full address", { mask: "none" }),
    v("domain", "Domain only (@example.com)", { mask: "domain" }),
    v("localpart", "Local part only (user)", { mask: "localpart" }),
  ]),
});
