/**
 * JSON-Schema validation of a merged config (§4.7).
 *
 * Validation is strict: unknown keys raise an error rather than silently
 * dropping (catches typos like `globel.padding`). The schema embeds at
 * build time via `src/schema/embedded.ts`.
 *
 * AJV is constructed with `strict: false` so the schema's per-widget
 * `options` bag (intentionally `additionalProperties: true` for
 * forward-compat — new widget types ship with new option keys) does
 * not trip strict-mode warnings. The merge layer drops `__proto__`,
 * `constructor`, and `prototype` keys before reaching this validator
 * (see `src/config/merge.ts`).
 */

import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import { CONFIG_SCHEMA } from "../../core/schema/embedded.js";
import { isColour } from "../theme/colours.js";
import type { AgentlineConfig } from "./types.js";

export class ConfigValidationError extends Error {
  readonly errors: ErrorObject[];
  constructor(errors: ErrorObject[]) {
    super(`agentline: config invalid:\n  ${formatErrors(errors)}`);
    this.name = "ConfigValidationError";
    this.errors = errors;
  }
}

let cached: ValidateFunction | null = null;

function compiled(): ValidateFunction {
  if (cached) return cached;
  const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: false });
  cached = ajv.compile(CONFIG_SCHEMA);
  return cached;
}

export function validateConfig(value: unknown): asserts value is AgentlineConfig {
  const validate = compiled();
  if (!validate(value)) {
    throw new ConfigValidationError(validate.errors ?? []);
  }
  narrowColours(value as AgentlineConfig);
}

/**
 * Belt-and-braces re-check that every persisted colour is a `Colour`.
 * The schema's `colourOrNull` pattern enforces this at validation
 * time, but a future schema edit that loosens the pattern would
 * silently leak unvalidated strings into the typed config. Catch it
 * here so the render path can consume typed colours without casts.
 */
function narrowColours(cfg: AgentlineConfig): void {
  const errors: ErrorObject[] = [];
  for (let li = 0; li < cfg.lines.length; li++) {
    const widgets = cfg.lines[li]?.widgets ?? [];
    for (let wi = 0; wi < widgets.length; wi++) {
      const w = widgets[wi];
      if (!w) continue;
      if (w.fg !== undefined && w.fg !== null && !isColour(w.fg)) {
        errors.push(colourError(`/lines/${li}/widgets/${wi}/fg`, w.fg));
      }
      if (w.bg !== undefined && w.bg !== null && !isColour(w.bg)) {
        errors.push(colourError(`/lines/${li}/widgets/${wi}/bg`, w.bg));
      }
    }
  }
  if (cfg.global.overrideFg !== null && !isColour(cfg.global.overrideFg)) {
    errors.push(colourError("/global/overrideFg", cfg.global.overrideFg));
  }
  if (cfg.global.overrideBg !== null && !isColour(cfg.global.overrideBg)) {
    errors.push(colourError("/global/overrideBg", cfg.global.overrideBg));
  }
  for (const [family, id] of Object.entries(cfg.families ?? {})) {
    if (id?.colour !== undefined && !isColour(id.colour)) {
      errors.push(colourError(`/families/${family}/colour`, id.colour));
    }
  }
  if (errors.length > 0) throw new ConfigValidationError(errors);
}

function colourError(instancePath: string, value: unknown): ErrorObject {
  return {
    instancePath,
    schemaPath: "#/definitions/colour",
    keyword: "colour",
    params: { value },
    message: `not a valid colour: ${JSON.stringify(value)}`,
  };
}

function formatErrors(errors: ErrorObject[]): string {
  return errors
    .map((e) => {
      const path = e.instancePath || "(root)";
      return `${path}: ${e.message ?? "invalid"}`;
    })
    .join("\n  ");
}
