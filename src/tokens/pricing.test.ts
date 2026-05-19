import { describe, expect, it } from "vitest";

import {
  evaluatePricingFreshness,
  listPricedModels,
  priceForModel,
  PRICING_TABLE_VERSION,
} from "./pricing.js";

describe("priceForModel", () => {
  it("returns the exact entry for known ids", () => {
    expect(priceForModel("claude-opus-4-7")).toEqual({ input: 15, output: 75, cached: 1.5 });
    expect(priceForModel("claude-sonnet-4-6")).toEqual({ input: 3, output: 15, cached: 0.3 });
  });

  it("matches by family prefix for unknown model variants", () => {
    expect(priceForModel("claude-opus-4-7-20990101")).toEqual({
      input: 15,
      output: 75,
      cached: 1.5,
    });
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

describe("evaluatePricingFreshness", () => {
  it("returns pass when the version is within 90 days of now", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const verdict = evaluatePricingFreshness("2026-04-20", now);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("2026-04-20");
    expect(verdict.message).toContain("24d old");
    expect(verdict.hint).toBeUndefined();
  });

  it("returns pass exactly on the 90-day boundary", () => {
    const now = new Date("2026-05-14T00:00:00Z");
    const versionDate = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
    const verdict = evaluatePricingFreshness(versionDate, now);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("90d old");
  });

  it("returns warn when the version is older than 90 days", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const verdict = evaluatePricingFreshness("2026-01-01", now);
    expect(verdict.status).toBe("warn");
    expect(verdict.message).toContain("2026-01-01");
    expect(verdict.message).toMatch(/133d old/);
    expect(verdict.message).toContain("threshold 90");
    expect(verdict.hint).toMatch(/PRICING_TABLE_VERSION/);
  });

  it("treats future-dated versions as fresh and reports zero age", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const verdict = evaluatePricingFreshness("2027-01-01", now);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("0d old");
  });

  it("returns warn with a parse-error message for a malformed version string", () => {
    const verdict = evaluatePricingFreshness("not-a-date", new Date("2026-05-14T12:00:00Z"));
    expect(verdict.status).toBe("warn");
    expect(verdict.message).toContain('PRICING_TABLE_VERSION="not-a-date"');
    expect(verdict.hint).toMatch(/src\/tokens\/pricing\.ts/);
  });

  it("rejects calendar-invalid dates that match the YYYY-MM-DD shape", () => {
    const verdict = evaluatePricingFreshness("2026-13-40", new Date("2026-05-14T12:00:00Z"));
    expect(verdict.status).toBe("warn");
    expect(verdict.message).toContain("2026-13-40");
  });
});
