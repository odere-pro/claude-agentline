import { describe, expect, it } from "vitest";

import { readIntFlag, readOptionsFlag } from "./_args.js";

const PREFIX = "agentline config widget test";

describe("readIntFlag", () => {
  it("reads a whitespace-separated integer", () => {
    expect(readIntFlag("--line", ["--line", "3"], 0, "--line", PREFIX)).toBe(3);
  });

  it("reads an equals-style integer", () => {
    expect(readIntFlag("--line=7", ["--line=7"], 0, "--line", PREFIX)).toBe(7);
  });

  it("throws 'requires an integer' when the value slot is empty", () => {
    expect(() => readIntFlag("--line", ["--line"], 0, "--line", PREFIX)).toThrow(
      /test: --line requires an integer/,
    );
  });

  it("throws 'requires an integer' when the value looks like another flag", () => {
    expect(() => readIntFlag("--line", ["--line", "--at"], 0, "--line", PREFIX)).toThrow(
      /test: --line requires an integer/,
    );
  });

  it("throws 'must be an integer' when the value is non-numeric", () => {
    expect(() => readIntFlag("--line", ["--line", "x"], 0, "--line", PREFIX)).toThrow(
      /test: --line must be an integer, got 'x'/,
    );
  });

  it("throws 'must be an integer' when the value is a float", () => {
    expect(() => readIntFlag("--line", ["--line", "1.5"], 0, "--line", PREFIX)).toThrow(
      /test: --line must be an integer, got '1.5'/,
    );
  });

  it("uses the caller's prefix verbatim in every error", () => {
    const customPrefix = "agentline config widget add";
    expect(() => readIntFlag("--line", ["--line"], 0, "--line", customPrefix)).toThrow(
      "agentline config widget add: --line requires an integer",
    );
    expect(() => readIntFlag("--line", ["--line", "x"], 0, "--line", customPrefix)).toThrow(
      "agentline config widget add: --line must be an integer, got 'x'",
    );
  });
});

describe("readOptionsFlag", () => {
  it("parses a valid JSON object", () => {
    expect(readOptionsFlag("--options", ["--options", '{"a":1}'], 0, PREFIX)).toEqual({ a: 1 });
  });

  it("parses an equals-style JSON object", () => {
    expect(readOptionsFlag('--options={"b":true}', ['--options={"b":true}'], 0, PREFIX)).toEqual({
      b: true,
    });
  });

  it("throws when the value slot is empty", () => {
    expect(() => readOptionsFlag("--options", ["--options"], 0, PREFIX)).toThrow(
      /test: --options requires a JSON object/,
    );
  });

  it("throws when the value is not valid JSON", () => {
    expect(() => readOptionsFlag("--options", ["--options", "not-json"], 0, PREFIX)).toThrow(
      /test: --options is not valid JSON/,
    );
  });

  it("rejects a JSON array", () => {
    expect(() => readOptionsFlag("--options", ["--options", "[]"], 0, PREFIX)).toThrow(
      /test: --options must be a JSON object/,
    );
  });

  it("rejects a JSON null", () => {
    expect(() => readOptionsFlag("--options", ["--options", "null"], 0, PREFIX)).toThrow(
      /test: --options must be a JSON object/,
    );
  });

  it("rejects prototype-polluting keys", () => {
    const cases: Array<[string, string]> = [
      ["__proto__", '{"__proto__":1}'],
      ["constructor", '{"constructor":1}'],
      ["prototype", '{"prototype":1}'],
    ];
    for (const [key, raw] of cases) {
      expect(() => readOptionsFlag("--options", ["--options", raw], 0, PREFIX)).toThrow(
        new RegExp(`option key '${key}' is not allowed`),
      );
    }
  });
});
