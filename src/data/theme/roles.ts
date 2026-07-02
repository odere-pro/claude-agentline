/**
 * Theme roles consumed by built-in widgets (§7.9).
 *
 * Roles split into two tiers:
 *
 *   - `REQUIRED_THEME_ROLES` — every theme file MUST supply all of these;
 *     the schema marks them `required`.
 *   - `OPTIONAL_THEME_ROLES` — a theme MAY supply these; when omitted, the
 *     colour falls back to the compiled default in `defaults.ts`. The schema
 *     lists them as allowed properties but not `required`, so a theme that
 *     predates the role (or a user theme that never sets it) still validates.
 *
 * `THEME_ROLES` is the union of both — the single list that drives the
 * `ThemeRole` type, the compiled `DEFAULT_PALETTE`, `resolveRole`, and the
 * theme loader's palette-fill loop. Adding a new role to either tier keeps
 * all of those in sync automatically.
 */

export const REQUIRED_THEME_ROLES = [
  "accent",
  "info",
  "success",
  "warning",
  "danger",
  "muted",
  "git-clean",
  "git-dirty",
  "tokens-low",
  "tokens-mid",
  "tokens-high",
  "bg-section",
  "bg-emphasis",
] as const;

/**
 * Optional roles fall back to the compiled default when a theme omits them,
 * so adding one is non-breaking for existing (and user-authored) themes.
 *
 * `effort-ultracode` — the `thinking-effort` widget's ultracode signature
 * colour. Optional because most themes are happy with the compiled violet
 * default; a theme with a light or otherwise clashing background can override
 * it for readable contrast (e.g. `claude-code-light`).
 */
export const OPTIONAL_THEME_ROLES = ["effort-ultracode"] as const;

export const THEME_ROLES = [...REQUIRED_THEME_ROLES, ...OPTIONAL_THEME_ROLES] as const;

export type ThemeRole = (typeof THEME_ROLES)[number];
