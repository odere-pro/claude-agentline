/**
 * Identity + per-session signals — `model`, `version`, `thinking-effort`,
 * `plan`, `session-id`, `account-email`.
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const SESSION_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  model: entry("Model", "Active model id (e.g. Sonnet 4.6)", "session"),
  version: entry("Version", "Claude Code version", "session"),
  "thinking-effort": entry(
    "Thinking effort",
    "Thinking-effort tier: low, medium, or high",
    "session",
  ),
  plan: entry("Plan", "Active plan for the current session", "session"),
  "session-id": entry("Session id", "Short session id", "session"),
  "account-email": entry("Account email", "Logged-in account email", "session", [
    v("full", "Full address", { mask: "none" }),
    v("domain", "Domain only (@example.com)", { mask: "domain" }),
    v("localpart", "Local part only (user)", { mask: "localpart" }),
  ]),
});
