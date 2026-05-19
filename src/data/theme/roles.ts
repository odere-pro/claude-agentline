/**
 * Theme roles consumed by built-in widgets (§7.9).
 *
 * Themes MUST define every role; missing roles fall back to compiled
 * defaults declared in `defaults.ts`.
 */

export const THEME_ROLES = [
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

export type ThemeRole = (typeof THEME_ROLES)[number];
