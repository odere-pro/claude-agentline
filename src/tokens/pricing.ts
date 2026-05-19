/**
 * Pricing table (§8.5). Versioned, embedded at build time. The bin
 * never fetches prices at runtime; maintainers refresh as part of
 * releases. Staleness is kept off the user-facing path: a unit test
 * plus the `gate-22-pricing-freshness` repo gate fail the build when
 * `PRICING_TABLE_VERSION` ages past the threshold.
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

/** Embedded pricing is considered stale once it is older than this. */
export const PRICING_FRESH_MAX_DAYS = 90;

const MS_PER_DAY = 86_400_000;

/** Verdict shape for {@link evaluatePricingFreshness} (no doctor coupling). */
export interface PricingFreshness {
  status: "pass" | "warn";
  message: string;
  hint?: string;
}

/**
 * Decide whether an embedded pricing-table version date is within the
 * staleness threshold. Pure helper so the unit test and `gate-22` stay
 * deterministic. Not surfaced by `agentline doctor` — pricing has no
 * runtime consumer, so freshness is a maintainer/CI concern only.
 */
export function evaluatePricingFreshness(version: string, now: Date): PricingFreshness {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  const parsed = match ? new Date(`${version}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return {
      status: "warn",
      message: `PRICING_TABLE_VERSION="${version}" is not a valid YYYY-MM-DD date`,
      hint: "ship a release with a corrected PRICING_TABLE_VERSION in src/tokens/pricing.ts",
    };
  }
  const rawAge = Math.floor((now.getTime() - parsed.getTime()) / MS_PER_DAY);
  const ageDays = Math.max(0, rawAge);
  if (ageDays <= PRICING_FRESH_MAX_DAYS) {
    return {
      status: "pass",
      message: `pricing table dated ${version} (${ageDays}d old)`,
    };
  }
  return {
    status: "warn",
    message: `pricing table dated ${version} is ${ageDays}d old (threshold ${PRICING_FRESH_MAX_DAYS})`,
    hint: "refresh src/tokens/pricing.ts and bump PRICING_TABLE_VERSION as part of the next release",
  };
}

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
