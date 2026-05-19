import { describe, it, expect } from "vitest";
import { envLayer } from "./env.js";

describe("envLayer", () => {
  it("ignores variables without the AGENTLINE_ prefix", () => {
    expect(envLayer({ HOME: "/x", PATH: "y" })).toEqual({});
  });

  it("maps a single segment to a top-level scalar", () => {
    expect(envLayer({ AGENTLINE_THEME: "nord" })).toEqual({ theme: "nord" });
  });

  it("maps multi-segment names to nested objects", () => {
    expect(envLayer({ AGENTLINE_GLOBAL_PADDING: "2" })).toEqual({ global: { padding: 2 } });
  });

  it("decodes JSON values when possible", () => {
    expect(envLayer({ AGENTLINE_POWERLINE_ENABLED: "true" })).toEqual({
      powerline: { enabled: true },
    });
    expect(envLayer({ AGENTLINE_GLOBAL_PADDING: "0" })).toEqual({ global: { padding: 0 } });
  });

  it("falls back to raw string when JSON decode fails", () => {
    expect(envLayer({ AGENTLINE_THEME: "catppuccin-mocha" })).toEqual({
      theme: "catppuccin-mocha",
    });
  });

  it("merges multiple variables into one tree", () => {
    expect(
      envLayer({
        AGENTLINE_GLOBAL_PADDING: "3",
        AGENTLINE_GLOBAL_BOLD: "true",
      }),
    ).toEqual({ global: { padding: 3, bold: true } });
  });
});
