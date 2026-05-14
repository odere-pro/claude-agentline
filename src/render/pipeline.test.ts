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

  it("emits a warning line for an unknown widget type", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "no-such-widget" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    const lines = result.split("\n");
    // First "line" is the rendered statusline (empty since the widget hides);
    // the next line carries the warning.
    expect(lines.some((l) => /unknown widget type 'no-such-widget'/.test(l))).toBe(true);
  });

  it("deduplicates repeated unknown widget types", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [
        { widgets: [{ type: "no-such-widget" }, { type: "no-such-widget" }] },
      ],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    const matches = result.match(/unknown widget type 'no-such-widget'/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("caps warning lines at MAX_WARNING_LINES (6) and emits them in sorted order", () => {
    const types = Array.from({ length: 12 }, (_, i) => ({ type: `bogus-${i}` }));
    const config = { ...DEFAULT_CONFIG, lines: [{ widgets: types }] };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    const warningLines = result
      .split("\n")
      .filter((l) => /unknown widget type/.test(l));
    expect(warningLines).toHaveLength(6);
    // `buildWarningLines` deduplicates + sorts the unknown types so the
    // surfaced lines stay stable across renders. Assert the sort.
    const sorted = [...warningLines].sort();
    expect(warningLines).toEqual(sorted);
  });

  it("emits no warning lines when every widget type is known", () => {
    const config = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "clock" }] }],
    };
    const result = renderFromInputs({
      payload: basePayload,
      config,
      theme: null,
      env: { NO_COLOR: "1" },
    });
    expect(result).not.toContain("unknown widget type");
  });
});
