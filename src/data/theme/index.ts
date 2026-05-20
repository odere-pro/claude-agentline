/**
 * Theme engine entry point (§5.4, §5.6).
 *
 * Public surface:
 *   - `Theme`              parsed + validated theme record
 *   - `loadTheme`          read + validate a theme JSON file
 *   - `loadThemeFromString`validate a theme JSON string (no I/O)
 *   - `resolveRole`        role → colour with default fallback
 *   - `THEME_ROLES`        reference list (§7.9)
 *
 * Theme files are validated against an embedded JSON Schema (§5.4).
 * This module performs no network I/O and no host-state mutation
 * (§1.2 N5, N6); it reads the supplied path read-only.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";

import { isColour, type Colour } from "./colours/colours.js";
import { DEFAULT_PALETTE } from "./defaults.js";
import { THEME_ROLES, type ThemeRole } from "./roles.js";
import { THEME_JSON_SCHEMA } from "./schema.js";
import { stripPrototypeKeys } from "../../core/lib/strip-prototype-keys/strip-prototype-keys.js";

export { THEME_ROLES };
export type { ThemeRole };
export type { Colour } from "./colours/colours.js";
export { DEFAULT_PALETTE } from "./defaults.js";

export interface Theme {
  readonly name: string;
  readonly palette: Readonly<Record<ThemeRole, Colour>>;
  readonly powerline: { readonly capsStart: string; readonly capsEnd: string };
  readonly source: "builtin" | "file";
  readonly path?: string;
}

export class ThemeLoadError extends Error {
  constructor(
    message: string,
    readonly errors?: readonly string[],
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ThemeLoadError";
  }
}

interface ThemeJsonShape {
  readonly $schema?: string;
  readonly name: string;
  readonly palette: Record<string, string>;
  readonly powerline?: {
    readonly "caps.start"?: string;
    readonly "caps.end"?: string;
  };
}

let cachedValidator: ValidateFunction<ThemeJsonShape> | null = null;

function getValidator(): ValidateFunction<ThemeJsonShape> {
  if (cachedValidator) return cachedValidator;
  const ajv = new Ajv({ allErrors: true, strict: false });
  cachedValidator = ajv.compile<ThemeJsonShape>(THEME_JSON_SCHEMA);
  return cachedValidator;
}

function buildTheme(json: ThemeJsonShape, source: "builtin" | "file", filePath?: string): Theme {
  const palette = {} as Record<ThemeRole, Colour>;
  for (const role of THEME_ROLES) {
    const supplied = json.palette[role];
    if (supplied !== undefined && isColour(supplied)) {
      palette[role] = supplied;
    } else {
      palette[role] = DEFAULT_PALETTE[role];
    }
  }
  return {
    name: json.name,
    palette,
    powerline: {
      capsStart: json.powerline?.["caps.start"] ?? "",
      capsEnd: json.powerline?.["caps.end"] ?? "",
    },
    source,
    ...(filePath !== undefined ? { path: filePath } : {}),
  };
}

export function loadThemeFromString(raw: string, filePath?: string): Theme {
  let parsed: unknown;
  try {
    parsed = stripPrototypeKeys(JSON.parse(raw));
  } catch (err) {
    throw new ThemeLoadError("theme is not valid JSON", undefined, err);
  }
  const validate = getValidator();
  if (!validate(parsed)) {
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`,
    );
    throw new ThemeLoadError("theme failed schema validation", errors);
  }
  /*
   * The typed `ValidateFunction<ThemeJsonShape>` narrowed `parsed` above.
   * Double-check colour patterns at runtime so the strict `Colour` cast
   * inside `buildTheme` stays sound even if the schema drifts.
   */
  const json = parsed;
  for (const role of THEME_ROLES) {
    const supplied = json.palette[role];
    if (supplied !== undefined && !isColour(supplied)) {
      throw new ThemeLoadError(`palette.${role} is not a valid colour: ${supplied}`);
    }
  }
  return buildTheme(json, filePath ? "file" : "builtin", filePath);
}

export async function loadTheme(themeFilePath: string): Promise<Theme> {
  const absolute = path.resolve(themeFilePath);
  let raw: string;
  try {
    raw = await fs.readFile(absolute, "utf8");
  } catch (err) {
    throw new ThemeLoadError(`unable to read theme file: ${absolute}`, undefined, err);
  }
  return loadThemeFromString(raw, absolute);
}

export function resolveRole(theme: Theme | null, role: ThemeRole): Colour {
  if (theme) return theme.palette[role];
  return DEFAULT_PALETTE[role];
}
