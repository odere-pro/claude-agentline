import { describe, expect, it } from "vitest";

import { resolveEnv } from "./env.js";

describe("resolveEnv", () => {
  it("returns process.env when input is undefined", () => {
    expect(resolveEnv(undefined)).toBe(process.env);
  });

  it("returns process.env when env field is omitted", () => {
    expect(resolveEnv({})).toBe(process.env);
  });

  it("returns the explicit env override unchanged", () => {
    const custom: NodeJS.ProcessEnv = { FOO: "bar" };
    expect(resolveEnv({ env: custom })).toBe(custom);
  });

  it("does not mutate the override", () => {
    const custom: NodeJS.ProcessEnv = { FOO: "bar" };
    resolveEnv({ env: custom });
    expect(custom).toEqual({ FOO: "bar" });
  });
});
