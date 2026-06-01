import { describe, expect, it } from "vitest";

import { parseClaudeDoctor, parseClaudeVersion } from "./parse.js";

describe("parseClaudeVersion", () => {
  it("extracts a semver from typical `claude --version` output", () => {
    expect(parseClaudeVersion("1.2.3 (cli build)")).toBe("1.2.3");
    expect(parseClaudeVersion("claude 0.9.10")).toBe("0.9.10");
  });

  it("captures a prerelease tag", () => {
    expect(parseClaudeVersion("2.0.0-beta.1 (cli build)")).toBe("2.0.0-beta.1");
  });

  it("returns null when there is no version / null input", () => {
    expect(parseClaudeVersion(null)).toBeNull();
    expect(parseClaudeVersion("no version here")).toBeNull();
  });
});

describe("parseClaudeDoctor", () => {
  it("returns null for empty or whitespace output", () => {
    expect(parseClaudeDoctor(null)).toBeNull();
    expect(parseClaudeDoctor("   \n  ")).toBeNull();
  });

  it("reports ok when no markers are present", () => {
    expect(parseClaudeDoctor("All checks passed\nEverything looks good")).toEqual({
      status: "ok",
      issues: 0,
      warnings: 0,
    });
  });

  it("counts warning lines", () => {
    const out = "Auth: ok\n⚠ Node version is outdated\nwarning: shell integration disabled";
    expect(parseClaudeDoctor(out)).toEqual({ status: "warn", issues: 0, warnings: 2 });
  });

  it("counts issue lines and ranks fail above warn", () => {
    const out = "✗ MCP server not found\n⚠ Node outdated\nError: config invalid";
    const got = parseClaudeDoctor(out);
    expect(got?.status).toBe("fail");
    expect(got?.issues).toBe(2);
    expect(got?.warnings).toBe(1);
  });

  it("strips ANSI colour codes before matching", () => {
    const out = "[31m✗ failed check[0m";
    expect(parseClaudeDoctor(out)).toEqual({ status: "fail", issues: 1, warnings: 0 });
  });
});
