import { describe, expect, it } from "vitest";

import {
  formatCostDuration,
  formatCount,
  formatSpeed,
  formatUsd,
  tokenRole,
} from "./format.js";

describe("formatCostDuration", () => {
  it("renders sub-minute durations with one decimal second", () => {
    expect(formatCostDuration(2300)).toBe("2.3s");
    expect(formatCostDuration(900)).toBe("0.9s");
  });

  it("renders a whole-second sub-minute duration without a trailing .0", () => {
    expect(formatCostDuration(5000)).toBe("5s");
  });

  it("renders 0ms as 0s", () => {
    expect(formatCostDuration(0)).toBe("0s");
  });

  it("renders minute-scale durations as 'Xm Ys' (seconds rounded, no decimal)", () => {
    expect(formatCostDuration(65_000)).toBe("1m 5s");
    expect(formatCostDuration(90_000)).toBe("1m 30s");
  });

  it("carries a rounded-up 60s into the next minute (never prints '60s')", () => {
    // 119.6s → 1m 59.6s → seconds round to 60 → carry to 2m 0s
    expect(formatCostDuration(119_600)).toBe("2m 0s");
  });

  it("renders hour-scale durations as 'Xh Ym' (seconds dropped)", () => {
    expect(formatCostDuration(65 * 60_000)).toBe("1h 5m");
    expect(formatCostDuration(2 * 60 * 60_000)).toBe("2h 0m");
  });

  it("clamps negative and non-finite inputs to 0s", () => {
    expect(formatCostDuration(-1)).toBe("0s");
    expect(formatCostDuration(Number.NaN)).toBe("0s");
    expect(formatCostDuration(Number.POSITIVE_INFINITY)).toBe("0s");
  });
});

describe("formatCount", () => {
  it("rounds and returns plain number below 1000", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(500.6)).toBe("501");
  });

  it("uses 1-decimal k suffix for 1000–9999", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1500)).toBe("1.5k");
    expect(formatCount(9999)).toBe("10k");
  });

  it("uses rounded k suffix for 10000–999499", () => {
    expect(formatCount(10_000)).toBe("10k");
    expect(formatCount(10_500)).toBe("11k");
    expect(formatCount(999_499)).toBe("999k");
  });

  it("promotes to M when rounding kilo would reach 1000k (bug-3)", () => {
    // 999_500 rounds to 1000k which overflows; must promote to "1M".
    expect(formatCount(999_500)).toBe("1M");
    expect(formatCount(999_999)).toBe("1M");
  });

  it("uses M suffix at 1_000_000+", () => {
    expect(formatCount(1_000_000)).toBe("1M");
    expect(formatCount(1_500_000)).toBe("1.5M");
    expect(formatCount(10_000_000)).toBe("10M");
  });

  it("trims trailing .0 in M suffix", () => {
    expect(formatCount(2_000_000)).toBe("2M");
  });
});

describe("formatSpeed", () => {
  it("returns '0' for less than 1 token/s", () => {
    expect(formatSpeed(0)).toBe("0");
    expect(formatSpeed(0.99)).toBe("0");
  });

  it("uses 1-decimal /s for 1–99", () => {
    expect(formatSpeed(1)).toBe("1/s");
    expect(formatSpeed(1.5)).toBe("1.5/s");
    expect(formatSpeed(99.9)).toBe("99.9/s");
  });

  it("uses rounded /s for 100–999.4", () => {
    expect(formatSpeed(100)).toBe("100/s");
    expect(formatSpeed(500.4)).toBe("500/s");
    expect(formatSpeed(999.4)).toBe("999/s");
  });

  it("promotes to k/s when rounding integer would reach 1000/s (bug-3)", () => {
    // 999.5 rounds to 1000/s which overflows; must promote to "1k/s".
    expect(formatSpeed(999.5)).toBe("1k/s");
    expect(formatSpeed(999.9)).toBe("1k/s");
  });

  it("uses k/s suffix at 1000+", () => {
    expect(formatSpeed(1000)).toBe("1k/s");
    expect(formatSpeed(1500)).toBe("1.5k/s");
    expect(formatSpeed(10_000)).toBe("10k/s");
  });

  it("trims trailing .0 in k/s suffix", () => {
    expect(formatSpeed(2000)).toBe("2k/s");
  });
});

describe("tokenRole", () => {
  it("returns tokens-low below 0.6", () => {
    expect(tokenRole(0)).toBe("tokens-low");
    expect(tokenRole(0.59)).toBe("tokens-low");
  });

  it("returns tokens-mid at exact 0.6 boundary", () => {
    expect(tokenRole(0.6)).toBe("tokens-mid");
  });

  it("returns tokens-mid between 0.6 and 0.8", () => {
    expect(tokenRole(0.7)).toBe("tokens-mid");
    expect(tokenRole(0.79)).toBe("tokens-mid");
  });

  it("returns tokens-high at exact 0.8 boundary", () => {
    expect(tokenRole(0.8)).toBe("tokens-high");
  });

  it("returns tokens-high above 0.8", () => {
    expect(tokenRole(0.9)).toBe("tokens-high");
    expect(tokenRole(1)).toBe("tokens-high");
  });
});

describe("formatUsd", () => {
  it("renders $0 for zero", () => {
    expect(formatUsd(0)).toBe("$0");
  });

  it("renders $1.23 for a typical sub-$10 cost with two decimals", () => {
    expect(formatUsd(1.23)).toBe("$1.23");
  });

  it("renders $0.50 for a half-dollar (two decimals below $1)", () => {
    expect(formatUsd(0.5)).toBe("$0.50");
  });

  it("renders $12 for a whole-dollar amount (no unnecessary decimal)", () => {
    expect(formatUsd(12)).toBe("$12");
  });

  it("renders $12.30 for $12.3", () => {
    expect(formatUsd(12.3)).toBe("$12.30");
  });

  it("renders $1.2k for 1200", () => {
    expect(formatUsd(1200)).toBe("$1.2k");
  });

  it("renders $10k for 10000", () => {
    expect(formatUsd(10_000)).toBe("$10k");
  });

  it("renders $1.5M for 1500000", () => {
    expect(formatUsd(1_500_000)).toBe("$1.5M");
  });

  it("handles small cents correctly — $0.01", () => {
    expect(formatUsd(0.01)).toBe("$0.01");
  });
});
