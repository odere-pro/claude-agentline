import { describe, expect, it } from "vitest";

import { ColourParseError, isColour, NAMED_COLOURS, parseColour } from "./colours.js";

describe("isColour", () => {
  it.each(NAMED_COLOURS)("accepts named colour %s", (named) => {
    expect(isColour(named)).toBe(true);
  });

  it("accepts truecolor hex", () => {
    expect(isColour("#0a1B2c")).toBe(true);
  });

  it("rejects malformed hex", () => {
    expect(isColour("#fff")).toBe(false);
    expect(isColour("#GGGGGG")).toBe(false);
  });

  it("accepts colour:NNN within 0..255", () => {
    expect(isColour("colour:0")).toBe(true);
    expect(isColour("colour:255")).toBe(true);
    expect(isColour("colour:128")).toBe(true);
  });

  it("rejects colour:NNN out of range", () => {
    expect(isColour("colour:256")).toBe(false);
    expect(isColour("colour:-1")).toBe(false);
    expect(isColour("colour:abc")).toBe(false);
  });

  it("rejects unrelated values", () => {
    expect(isColour("orange")).toBe(false);
    expect(isColour(42)).toBe(false);
    expect(isColour(null)).toBe(false);
    expect(isColour(undefined)).toBe(false);
  });
});

describe("parseColour", () => {
  it("parses named colour", () => {
    expect(parseColour("red")).toEqual({ kind: "named", value: "red" });
  });

  it("parses indexed colour", () => {
    expect(parseColour("colour:42")).toEqual({ kind: "indexed", index: 42 });
  });

  it("parses hex into RGB triple", () => {
    expect(parseColour("#102030")).toEqual({ kind: "hex", r: 0x10, g: 0x20, b: 0x30 });
  });

  it("throws on invalid input", () => {
    expect(() => parseColour("invalid")).toThrow(ColourParseError);
    expect(() => parseColour(123)).toThrow(ColourParseError);
  });
});
