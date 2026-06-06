/**
 * The shipped schema's `widget.type` enum is generated from the widget
 * catalogue by `scripts/gen-schema-enum.mjs` (prebuild step). This test is
 * the vitest mirror of gate-28: it fails fast if the checked-in schema
 * drifts from the catalogue, without needing node + esbuild on PATH.
 */

import { describe, expect, it } from "vitest";

import { CONFIG_SCHEMA } from "./embedded.js";
import { WIDGET_CATALOG } from "../../../widgets/families/catalog.js";

interface SchemaShape {
  readonly definitions?: {
    readonly widget?: {
      readonly properties?: {
        readonly type?: { readonly enum?: readonly string[] };
        readonly version?: unknown;
      };
    };
  };
  readonly properties?: { readonly version?: { readonly enum?: readonly number[] } };
  readonly $id?: string;
}

const schema = CONFIG_SCHEMA as SchemaShape;

describe("config schema widget.type enum", () => {
  it("equals the sorted catalogue keys", () => {
    const enumValues = schema.definitions?.widget?.properties?.type?.enum;
    expect(enumValues).toBeDefined();
    expect([...(enumValues ?? [])]).toEqual(Object.keys(WIDGET_CATALOG).sort());
  });

  it("contains every catalogued widget type (no missing, no extra)", () => {
    const enumSet = new Set(schema.definitions?.widget?.properties?.type?.enum ?? []);
    const catalogSet = new Set(Object.keys(WIDGET_CATALOG));
    const missing = [...catalogSet].filter((t) => !enumSet.has(t));
    const extra = [...enumSet].filter((t) => !catalogSet.has(t));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});

describe("config schema version + $id", () => {
  it("pins version to enum [1] (refuse unknown future versions, D-007)", () => {
    expect(schema.properties?.version?.enum).toEqual([1]);
  });

  it("uses the raw.githubusercontent.com $id so the URL resolves", () => {
    expect(schema.$id).toBe(
      "https://raw.githubusercontent.com/odere-pro/claude-agentline/main/schemas/config.schema.json",
    );
  });
});
