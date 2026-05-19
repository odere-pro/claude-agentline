import { describe, it, expect } from "vitest";
import { isPlainObject, pickString, pickStringArray, pickEnum } from "./object.js";

describe("isPlainObject", () => {
  it("accepts a plain object literal", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1, b: "two" })).toBe(true);
  });

  it("accepts Object.create(null)", () => {
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it("rejects null", () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it("rejects arrays", () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2, 3])).toBe(false);
  });

  it("rejects primitives", () => {
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject(0)).toBe(false);
    expect(isPlainObject("")).toBe(false);
    expect(isPlainObject("x")).toBe(false);
    expect(isPlainObject(true)).toBe(false);
  });

  it("rejects class instances and exotic objects", () => {
    class Foo {}
    expect(isPlainObject(new Foo())).toBe(false);
    expect(isPlainObject(new Map())).toBe(false);
    expect(isPlainObject(new Set())).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
  });

  it("narrows for TS — usable as a property bag after the guard", () => {
    const v: unknown = { a: 1 };
    if (isPlainObject(v)) {
      expect(v["a"]).toBe(1);
    } else {
      throw new Error("guard rejected a plain object");
    }
  });
});

describe("pickString", () => {
  it("returns the value when it is a non-empty string", () => {
    expect(pickString({ k: "hello" }, "k")).toBe("hello");
  });

  it("returns undefined for empty string, non-string, missing key, or undefined obj", () => {
    expect(pickString({ k: "" }, "k")).toBeUndefined();
    expect(pickString({ k: 1 }, "k")).toBeUndefined();
    expect(pickString({}, "k")).toBeUndefined();
    expect(pickString(undefined, "k")).toBeUndefined();
  });
});

describe("pickStringArray", () => {
  it("filters to non-empty strings", () => {
    expect(pickStringArray({ k: ["a", "", "b", 1, null] }, "k")).toEqual(["a", "b"]);
  });

  it("returns undefined when no usable entries remain", () => {
    expect(pickStringArray({ k: ["", 1] }, "k")).toBeUndefined();
    expect(pickStringArray({ k: "not-an-array" }, "k")).toBeUndefined();
    expect(pickStringArray(undefined, "k")).toBeUndefined();
  });
});

describe("pickEnum", () => {
  const allowed = new Set(["one", "two"] as const);

  it("returns the value when it is in the allowed set", () => {
    expect(pickEnum({ k: "one" }, "k", allowed)).toBe("one");
  });

  it("returns undefined for unknown values, non-strings, missing keys", () => {
    expect(pickEnum({ k: "three" }, "k", allowed)).toBeUndefined();
    expect(pickEnum({ k: 1 }, "k", allowed)).toBeUndefined();
    expect(pickEnum({}, "k", allowed)).toBeUndefined();
  });
});
