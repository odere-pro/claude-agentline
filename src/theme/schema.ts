/**
 * Embedded JSON Schema for `themes/*.json` files (§5.4).
 *
 * The schema is the source of truth for theme validation. It is also
 * exported so editors can pick it up without a network round-trip.
 */

import { THEME_ROLES } from "./roles.js";

const COLOUR_PATTERN = "^(#[0-9a-fA-F]{6}|colour:(0|[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-5])|black|red|green|yellow|blue|magenta|cyan|white|bright-(black|red|green|yellow|blue|magenta|cyan|white))$";

export const THEME_JSON_SCHEMA = {
  $id: "https://github.com/odere-pro/claude-agentline/schemas/theme.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "agentline theme",
  type: "object",
  required: ["name", "palette"],
  additionalProperties: false,
  properties: {
    $schema: { type: "string" },
    name: {
      type: "string",
      pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
      minLength: 1,
      maxLength: 64,
    },
    palette: {
      type: "object",
      additionalProperties: false,
      required: [...THEME_ROLES],
      properties: Object.fromEntries(
        THEME_ROLES.map((role) => [role, { type: "string", pattern: COLOUR_PATTERN }]),
      ),
    },
    powerline: {
      type: "object",
      additionalProperties: false,
      properties: {
        "caps.start": { type: "string", maxLength: 4 },
        "caps.end": { type: "string", maxLength: 4 },
      },
    },
  },
} as const;
