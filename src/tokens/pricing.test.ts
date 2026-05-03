import { describe, expect, it } from "vitest";

import { listPricedModels, priceForModel, PRICING_TABLE_VERSION } from "./pricing.js";

describe("priceForModel", () => {
  it("returns the exact entry for known ids", () => {
    expect(priceForModel("claude-opus-4-7")).toEqual({ input: 15, output: 75, cached: 1.5 });
    expect(priceForModel("claude-sonnet-4-6")).toEqual({ input: 3, output: 15, cached: 0.3 });
  });

  it("matches by family prefix for unknown model variants", () => {
    expect(priceForModel("claude-opus-4-7-20990101")).toEqual({ input: 15, output: 75, cached: 1.5 });
    expect(priceForModel("claude-haiku-4-9")).toEqual({ input: 1, output: 5, cached: 0.1 });
  });

  it("falls back to defaults for completely unknown models", () => {
    expect(priceForModel("future-x")).toEqual({ input: 3, output: 15, cached: 0.3 });
  });

  it("falls back to defaults for undefined", () => {
    expect(priceForModel(undefined)).toEqual({ input: 3, output: 15, cached: 0.3 });
  });

  it("differentiates the [1m] context-window variant", () => {
    expect(priceForModel("claude-opus-4-7[1m]")).toEqual({ input: 30, output: 150, cached: 3 });
  });
});

describe("PRICING_TABLE_VERSION", () => {
  it("is a calendar string", () => {
    expect(PRICING_TABLE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("listPricedModels", () => {
  it("returns at least the four shipped models", () => {
    const models = listPricedModels();
    expect(models).toContain("claude-opus-4-7");
    expect(models).toContain("claude-sonnet-4-6");
  });
});
