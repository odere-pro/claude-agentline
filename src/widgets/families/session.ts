/**
 * Identity + per-session signals — `model`, `version`, `thinking-effort`,
 * `thinking-enabled`, `plan`, `session-id`, `account-email`,
 * `session-duration`, `lines-changed`, `cwd-path`, `agent-name`.
 *
 * `project` / `project-dir` moved to the `git` family, and `clock` /
 * `added-dirs` / `output-style` / `vim-mode` moved to the `other` family
 * (catalogue `family` field only — their render-fn folders stay under
 * `src/widgets/session/`).
 */

import { entry, v, type WidgetMeta } from "./catalog-types.js";

export const SESSION_CATALOG: Readonly<Record<string, WidgetMeta>> = Object.freeze({
  model: entry("Model", "Active model id (e.g. Sonnet 4.6)", "session"),
  version: entry("Version", "Claude Code version", "session"),
  "thinking-effort": entry(
    "Thinking effort",
    "Thinking-effort tier: low through max, plus ultracode",
    "session",
  ),
  "thinking-enabled": entry(
    "Thinking enabled",
    "Whether extended thinking is on (complements thinking-effort)",
    "session",
  ),
  plan: entry("Plan", "Active plan for the current session", "session"),
  "session-id": entry("Session id", "Short session id", "session"),
  "account-email": entry("Account email", "Logged-in account email", "session", [
    v("full", "Full address", { mask: "none" }),
    v("domain", "Domain only (@example.com)", { mask: "domain" }),
    v("localpart", "Local part only (user)", { mask: "localpart" }),
  ]),
  "session-duration": entry(
    "Session duration",
    "Host-reported session elapsed time (e.g. 12m 30s)",
    "session",
  ),
  "lines-changed": entry(
    "Lines changed",
    "Host-reported lines added and removed this session (e.g. +156 −23)",
    "session",
  ),
  "cwd-path": entry(
    "Working directory",
    "Current working-directory path, home-collapsed and truncatable",
    "session",
  ),
  "agent-name": entry("Agent name", "Active subagent persona name", "session"),
});
