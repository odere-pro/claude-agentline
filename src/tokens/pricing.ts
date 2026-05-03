/**
 * Pricing table (§8.5). Versioned, embedded at build time. The bin
 * never fetches prices at runtime; maintainers refresh as part of
 * releases. `agentline doctor` reports `PRICING_TABLE_VERSION` so
 * users can tell at a glance whether the install is current.
 *
 * Prices are USD per million tokens. `cached` is the cache-read rate
 * (cache-write is rolled into the input rate per the upstream
 * published table for the families we ship).
 */

export interface ModelPrice {
  readonly input: number;
  readonly output: number;
  readonly cached: number;
}

export const PRICING_TABLE_VERSION = "2026-05-03";

const TABLE: ReadonlyMap<string, ModelPrice> = new Map([
  ["claude-opus-4-7", { input: 15, output: 75, cached: 1.5 }],
  ["claude-opus-4-7[1m]", { input: 30, output: 150, cached: 3 }],
  ["claude-sonnet-4-6", { input: 3, output: 15, cached: 0.3 }],
  ["claude-haiku-4-5", { input: 1, output: 5, cached: 0.1 }],
  ["claude-haiku-4-5-20251001", { input: 1, output: 5, cached: 0.1 }],
]);

const DEFAULT_PRICE: ModelPrice = { input: 3, output: 15, cached: 0.3 };

export function priceForModel(modelId: string | undefined): ModelPrice {
  if (!modelId) return DEFAULT_PRICE;
  return TABLE.get(modelId) ?? matchByPrefix(modelId) ?? DEFAULT_PRICE;
}

function matchByPrefix(modelId: string): ModelPrice | undefined {
  if (modelId.startsWith("claude-opus")) return TABLE.get("claude-opus-4-7");
  if (modelId.startsWith("claude-sonnet")) return TABLE.get("claude-sonnet-4-6");
  if (modelId.startsWith("claude-haiku")) return TABLE.get("claude-haiku-4-5");
  return undefined;
}

export function listPricedModels(): readonly string[] {
  return Array.from(TABLE.keys());
}
