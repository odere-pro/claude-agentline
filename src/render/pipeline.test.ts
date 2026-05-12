import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/index.js";
import { renderFromInputs, type RenderInputs } from "./pipeline.js";

const ESC = "\x1b[";

const basePayload = { raw: {}, truncated: false };

const emptyConfig = { ...DEFAULT_CONFIG, lines: [] };

function makeInputs(overrides: Partial<RenderInputs> = {}): RenderInputs {
  return {
    payload: basePayload,
    config: emptyConfig,
    theme: null,
    ...overrides,
  };
}

describe("renderFromInputs", () => {
  it("returns '\\n' when config has no lines", () => {
    const result = renderFromInputs(makeInputs());
    expect(result).toBe("\n");
  });

  it("always ends with a newline", () => {
    const result = renderFromInputs(makeInputs());
    expect(result).toMatch(/\n$/);
  });

  it("can be called twice without throwing (ensureRegistry is idempotent)", () => {
    expect(() => {
      renderFromInputs(makeInputs());
      renderFromInputs(makeInputs());
    }).not.toThrow();
  });

  it("produces no ANSI escape sequences when NO_COLOR=1", () => {
    const result = renderFromInputs(makeInputs({ env: { NO_COLOR: "1" } }));
    expect(result).not.toContain(ESC);
  });

  it("returns a string with NO_COLOR=1 and default config", () => {
    const result = renderFromInputs({
      payload: basePayload,
      config: DEFAULT_CONFIG,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a string type for empty config", () => {
    const result = renderFromInputs(makeInputs());
    expect(typeof result).toBe("string");
  });
});
