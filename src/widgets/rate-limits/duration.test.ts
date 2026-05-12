import { describe, expect, it } from "vitest";

import { formatDuration, resolveDurationFormat } from "./duration.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("formatDuration", () => {
  it("returns '0m' for zero milliseconds in short format", () => {
    expect(formatDuration(0, "short")).toBe("0m");
  });

  it("short format omits the hour segment when zero", () => {
    expect(formatDuration(45 * MINUTE_MS, "short")).toBe("45m");
  });

  it("short format combines hours and minutes without space", () => {
    expect(formatDuration(3 * HOUR_MS + 12 * MINUTE_MS, "short")).toBe("3h12m");
  });

  it("long format adds a space between hours and minutes", () => {
    expect(formatDuration(3 * HOUR_MS + 12 * MINUTE_MS, "long")).toBe("3h 12m");
  });

  it("long format omits hour when zero", () => {
    expect(formatDuration(45 * MINUTE_MS, "long")).toBe("45m");
  });

  it("clock format pads to HH:MM:SS", () => {
    expect(formatDuration(3 * HOUR_MS + 12 * MINUTE_MS + 5_000, "clock")).toBe("03:12:05");
  });

  it("clock format renders 00:00:00 for zero", () => {
    expect(formatDuration(0, "clock")).toBe("00:00:00");
  });

  it("clamps negative inputs to zero (short)", () => {
    expect(formatDuration(-1_000, "short")).toBe("0m");
  });

  it("clamps negative inputs to zero (clock)", () => {
    expect(formatDuration(-1_000, "clock")).toBe("00:00:00");
  });

  it("handles exactly one hour in short format", () => {
    expect(formatDuration(HOUR_MS, "short")).toBe("1h0m");
  });

  it("handles exactly one hour in clock format", () => {
    expect(formatDuration(HOUR_MS, "clock")).toBe("01:00:00");
  });

  it("defaults to short format when format arg is omitted", () => {
    expect(formatDuration(30 * MINUTE_MS)).toBe("30m");
  });
});

describe("resolveDurationFormat", () => {
  it("accepts 'short'", () => {
    expect(resolveDurationFormat("short")).toBe("short");
  });

  it("accepts 'long'", () => {
    expect(resolveDurationFormat("long")).toBe("long");
  });

  it("accepts 'clock'", () => {
    expect(resolveDurationFormat("clock")).toBe("clock");
  });

  it("falls back to 'short' for unrecognised strings", () => {
    expect(resolveDurationFormat("garbage")).toBe("short");
  });

  it("falls back to 'short' for non-string inputs", () => {
    expect(resolveDurationFormat(undefined)).toBe("short");
    expect(resolveDurationFormat(42)).toBe("short");
    expect(resolveDurationFormat(null)).toBe("short");
  });

  it("uses custom fallback when provided", () => {
    expect(resolveDurationFormat(undefined, "long")).toBe("long");
    expect(resolveDurationFormat("invalid", "clock")).toBe("clock");
  });
});
