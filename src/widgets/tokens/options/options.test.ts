import { describe, expect, it } from "vitest";

import { resolveResetAxis } from "./options.js";

describe("resolveResetAxis", () => {
  it("returns 'session' for each valid axis string", () => {
    const valid = ["session", "block", "day", "week", "model", "effort"] as const;
    for (const axis of valid) {
      expect(resolveResetAxis(axis)).toBe(axis);
    }
  });

  it("returns 'session' for a typo", () => {
    expect(resolveResetAxis("sessoin")).toBe("session");
    expect(resolveResetAxis("daily")).toBe("session");
    expect(resolveResetAxis("BLOCK")).toBe("session");
  });

  it("returns 'session' for a number", () => {
    expect(resolveResetAxis(42)).toBe("session");
    expect(resolveResetAxis(0)).toBe("session");
  });

  it("returns 'session' for undefined", () => {
    expect(resolveResetAxis(undefined)).toBe("session");
  });

  it("returns 'session' for null", () => {
    expect(resolveResetAxis(null)).toBe("session");
  });

  it("returns 'session' for an empty string", () => {
    expect(resolveResetAxis("")).toBe("session");
  });

  it("returns 'session' for an object", () => {
    expect(resolveResetAxis({ reset: "day" })).toBe("session");
  });
});
