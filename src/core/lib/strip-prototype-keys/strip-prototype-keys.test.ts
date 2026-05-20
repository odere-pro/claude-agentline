import { describe, it, expect } from "vitest";
import { stripPrototypeKeys } from "./strip-prototype-keys.js";

describe("stripPrototypeKeys", () => {
  it("drops top-level __proto__ / constructor / prototype keys", () => {
    const input = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":1,"prototype":2,"keep":"yes"}',
    );
    expect(stripPrototypeKeys(input)).toEqual({ keep: "yes" });
  });

  it("drops nested forbidden keys recursively", () => {
    const input = JSON.parse(
      '{"nested":{"__proto__":{"x":1},"deeper":{"constructor":"bad","ok":true}}}',
    );
    expect(stripPrototypeKeys(input)).toEqual({
      nested: { deeper: { ok: true } },
    });
  });

  it("walks into array elements", () => {
    const input = JSON.parse('[{"__proto__":{"x":1}},{"ok":true}]');
    expect(stripPrototypeKeys(input)).toEqual([{}, { ok: true }]);
  });

  it("passes scalars through unchanged", () => {
    expect(stripPrototypeKeys(null)).toBeNull();
    expect(stripPrototypeKeys("s")).toBe("s");
    expect(stripPrototypeKeys(7)).toBe(7);
    expect(stripPrototypeKeys(true)).toBe(true);
  });

  it("does not mutate input", () => {
    const input = JSON.parse('{"keep":1,"__proto__":{"x":1}}');
    const snapshot = JSON.stringify(input);
    stripPrototypeKeys(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("does not pollute Object.prototype when given a hostile payload", () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true}}');
    stripPrototypeKeys(hostile);
    const probe = {} as Record<string, unknown>;
    expect(probe["polluted"]).toBeUndefined();
  });
});
