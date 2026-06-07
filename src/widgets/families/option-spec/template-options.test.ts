/**
 * Regression guard for the strict option validator (F-A part 1): every
 * shipped config template must pass `validateWidgetOptions` for every
 * widget it places. A too-strict spec that rejects an option a template
 * legitimately uses would break the seeded config — this test fails loudly
 * if that ever happens.
 *
 * Templates are validated through the SAME `validateWidgetOptions` the
 * mutation CLI uses, so "what `config init` seeds" and "what `config
 * widget add` will accept" can never diverge.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateWidgetOptions } from "./option-spec.js";

const TEMPLATES = ["default", "minimal", "power"] as const;

function templatesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/widgets/families/option-spec → repo root is five levels up.
  return resolve(here, "..", "..", "..", "..", "templates");
}

interface WidgetEntry {
  readonly type: string;
  readonly options?: Record<string, unknown>;
}
interface TemplateShape {
  readonly lines?: { readonly widgets?: readonly WidgetEntry[] }[];
}

describe("shipped templates pass strict option validation", () => {
  for (const name of TEMPLATES) {
    it(`${name}.config.json — every widget's options are accepted`, () => {
      const path = join(templatesDir(), `${name}.config.json`);
      const tmpl = JSON.parse(readFileSync(path, "utf8")) as TemplateShape;
      for (const line of tmpl.lines ?? []) {
        for (const widget of line.widgets ?? []) {
          if (!widget.options) continue;
          const err = validateWidgetOptions(widget.type, widget.options);
          expect(
            err,
            `${name}: widget '${widget.type}' options ${JSON.stringify(widget.options)} rejected: ${err}`,
          ).toBeNull();
        }
      }
    });
  }
});
