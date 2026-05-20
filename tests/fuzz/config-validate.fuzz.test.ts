/**
 * Property-based fuzzing of the config validator.
 *
 * `validateConfig` guards every config that reaches the render path. The
 * property: for arbitrary input it either accepts (returns) or rejects
 * with the typed `ConfigValidationError` — it must never leak an AJV
 * internal error or a raw `TypeError`, which would crash the CLI instead
 * of producing a readable "config invalid" message.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ConfigValidationError, validateConfig } from "../../src/data/config/validate/validate.js";

describe("fuzz: validateConfig", () => {
  it("only ever throws ConfigValidationError for arbitrary input", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        try {
          validateConfig(value);
        } catch (err) {
          expect(err).toBeInstanceOf(ConfigValidationError);
        }
      }),
    );
  });

  it("rejects arbitrary objects shaped like a partial config without crashing", () => {
    const arb = fc.record(
      {
        lines: fc.array(fc.object(), { maxLength: 4 }),
        global: fc.object(),
        families: fc.object(),
        theme: fc.oneof(fc.string(), fc.constant(null)),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(arb, (value) => {
        try {
          validateConfig(value);
        } catch (err) {
          expect(err).toBeInstanceOf(ConfigValidationError);
        }
      }),
    );
  });
});
