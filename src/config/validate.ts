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
import { CONFIG_SCHEMA } from "../schema/embedded.js";

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

export function validateConfig(value: unknown): void {
  const validate = compiled();
  if (!validate(value)) {
    throw new ConfigValidationError(validate.errors ?? []);
  }
}

function formatErrors(errors: ErrorObject[]): string {
  return errors
    .map((e) => {
      const path = e.instancePath || "(root)";
      return `${path}: ${e.message ?? "invalid"}`;
    })
    .join("\n  ");
}
