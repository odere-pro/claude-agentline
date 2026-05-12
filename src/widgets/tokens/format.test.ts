import { describe, expect, it } from "vitest";

import { formatCount, formatCost, formatSpeed, tokenRole } from "./format.js";

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

  it("uses rounded k suffix for 10000–999999", () => {
    expect(formatCount(10_000)).toBe("10k");
    expect(formatCount(10_500)).toBe("11k");
    expect(formatCount(999_999)).toBe("1000k");
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

describe("formatCost", () => {
  it("returns $0.00 when cost is below $0.01", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0.009)).toBe("$0.00");
  });

  it("uses 2-decimal format for $0.01–$9.99", () => {
    expect(formatCost(0.01)).toBe("$0.01");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(9.99)).toBe("$9.99");
  });

  it("uses 1-decimal format for $10–$99.9", () => {
    expect(formatCost(10)).toBe("$10.0");
    expect(formatCost(50.5)).toBe("$50.5");
    expect(formatCost(99.9)).toBe("$99.9");
  });

  it("uses rounded integer format for $100+", () => {
    expect(formatCost(100)).toBe("$100");
    expect(formatCost(150.7)).toBe("$151");
    expect(formatCost(1000)).toBe("$1000");
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

  it("uses rounded /s for 100–999", () => {
    expect(formatSpeed(100)).toBe("100/s");
    expect(formatSpeed(500.4)).toBe("500/s");
    expect(formatSpeed(999)).toBe("999/s");
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
