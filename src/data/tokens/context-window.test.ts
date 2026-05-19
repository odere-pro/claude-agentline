import { describe, expect, it } from "vitest";

import { contextWindowFor } from "./context-window.js";

describe("contextWindowFor", () => {
  it("returns 200k for the default Sonnet/Opus models", () => {
    expect(contextWindowFor("claude-opus-4-7")).toBe(200_000);
    expect(contextWindowFor("claude-sonnet-4-6")).toBe(200_000);
    expect(contextWindowFor("claude-haiku-4-5")).toBe(200_000);
  });

  it("returns 1M for the [1m] context-window variant", () => {
    expect(contextWindowFor("claude-opus-4-7[1m]")).toBe(1_000_000);
  });

  it("falls back to 200k for unknown ids", () => {
    expect(contextWindowFor("future-x")).toBe(200_000);
    expect(contextWindowFor(undefined)).toBe(200_000);
  });

  it("infers 1M when the variant marker is present", () => {
    expect(contextWindowFor("claude-future-9[1m]")).toBe(1_000_000);
  });
});
