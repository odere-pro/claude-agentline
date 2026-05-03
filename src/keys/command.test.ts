import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_KEY_BINDINGS } from "./bindings.js";
import {
  formatJson,
  formatText,
  parseKeysArgs,
  runKeysCommand,
} from "./command.js";

describe("parseKeysArgs", () => {
  it("defaults to non-JSON output", () => {
    expect(parseKeysArgs([])).toEqual({ json: false });
  });

  it("--json enables JSON output", () => {
    expect(parseKeysArgs(["--json"])).toEqual({ json: true });
  });

  it("rejects unknown args", () => {
    expect(() => parseKeysArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("formatJson", () => {
  it("emits a wrapper object with all bindings", () => {
    const json = formatJson(DEFAULT_KEY_BINDINGS);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.bindings)).toBe(true);
    expect(parsed.bindings.length).toBe(DEFAULT_KEY_BINDINGS.length);
    expect(parsed.bindings[0]).toMatchObject({
      key: expect.any(String),
      action: expect.any(String),
      scope: expect.any(String),
      description: expect.any(String),
    });
  });
});

describe("formatText", () => {
  it("includes every binding once", () => {
    const text = formatText(DEFAULT_KEY_BINDINGS);
    for (const b of DEFAULT_KEY_BINDINGS) {
      expect(text).toContain(b.description);
    }
  });
});

describe("runKeysCommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the JSON form when --json is set", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runKeysCommand({
      args: { json: true },
      bindings: DEFAULT_KEY_BINDINGS,
    });
    expect(code).toBe(0);
    const arg = stdout.mock.calls[0]?.[0];
    expect(typeof arg).toBe("string");
    expect(JSON.parse(String(arg)).bindings).toHaveLength(DEFAULT_KEY_BINDINGS.length);
  });

  it("prints the text form by default", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runKeysCommand({ args: { json: false }, bindings: DEFAULT_KEY_BINDINGS });
    const arg = String(stdout.mock.calls[0]?.[0] ?? "");
    expect(arg).toContain("agentline keymap:");
  });
});
