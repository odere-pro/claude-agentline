import { describe, it, expect } from "vitest";
import { validateConfig, ConfigValidationError } from "./validate.js";
import { DEFAULT_CONFIG } from "./defaults.js";

describe("validateConfig", () => {
  it("accepts the default config", () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it("rejects unknown top-level keys", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, mystery: 1 })).toThrowError(
      ConfigValidationError,
    );
  });

  it("rejects an invalid colour value", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", fg: "neon-pink" }] }],
    };
    expect(() => validateConfig(cfg)).toThrowError(ConfigValidationError);
  });

  it("accepts a hex colour", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", fg: "#ff8800" }] }],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("accepts a colour:N index in range", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", bg: "colour:208" }] }],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("rejects colour:N out of range", () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "model", bg: "colour:999" }] }],
    };
    expect(() => validateConfig(cfg)).toThrowError(ConfigValidationError);
  });

  it("rejects empty lines array", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, lines: [] })).toThrowError(
      ConfigValidationError,
    );
  });

  it("accepts a line with no widgets (empty lines render blank)", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, lines: [{ widgets: [] }] })).not.toThrow();
  });
});
