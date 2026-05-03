import { describe, expect, it } from "vitest";

import { frozenClock, realClock } from "./clock.js";

describe("realClock", () => {
  it("returns a Date close to wall-clock", () => {
    const before = Date.now();
    const t = realClock.now().getTime();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});

describe("frozenClock", () => {
  it("always returns the same instant from a Date", () => {
    const at = new Date("2026-01-15T12:34:56.000Z");
    const c = frozenClock(at);
    expect(c.now().toISOString()).toBe("2026-01-15T12:34:56.000Z");
    expect(c.now().toISOString()).toBe("2026-01-15T12:34:56.000Z");
  });

  it("accepts ISO strings and epoch numbers", () => {
    const a = frozenClock("2026-03-01T00:00:00Z");
    expect(a.now().toISOString()).toBe("2026-03-01T00:00:00.000Z");
    const b = frozenClock(0);
    expect(b.now().toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("each call returns a fresh Date instance to prevent caller mutation", () => {
    const c = frozenClock("2026-01-15T00:00:00Z");
    const a = c.now();
    a.setUTCFullYear(1999);
    expect(c.now().getUTCFullYear()).toBe(2026);
  });

  it("rejects invalid input", () => {
    expect(() => frozenClock("not a date")).toThrow(/invalid date/);
  });
});
