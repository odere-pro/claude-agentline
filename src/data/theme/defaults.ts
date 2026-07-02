/**
 * Compiled default palette used when no theme is configured or when a
 * loaded theme omits a role (§5.4). Values are conservative truecolor
 * picks that degrade cleanly to 256/16 colour modes (§8.3).
 */

import type { Colour } from "./colours/colours.js";
import { THEME_ROLES, type ThemeRole } from "./roles.js";

export const DEFAULT_PALETTE: Readonly<Record<ThemeRole, Colour>> = Object.freeze({
  accent: "#7aa2f7",
  info: "#7dcfff",
  success: "#9ece6a",
  warning: "#e0af68",
  danger: "#f7768e",
  muted: "#565f89",
  "git-clean": "#9ece6a",
  "git-dirty": "#e0af68",
  "tokens-low": "#9ece6a",
  "tokens-mid": "#e0af68",
  "tokens-high": "#f7768e",
  "bg-section": "#1a1b26",
  "bg-emphasis": "#24283b",
  // ultracode's signature violet — a single fixed value kept identical across
  // every shipped theme (see themes/*.json), matching the host CLI's hue.
  "effort-ultracode": "#b1a7f5",
});

export const DEFAULT_THEME_NAME = "neutral-dark-fallback";

export function defaultRoleColour(role: ThemeRole): Colour {
  return DEFAULT_PALETTE[role];
}

export function listRoles(): readonly ThemeRole[] {
  return THEME_ROLES;
}
