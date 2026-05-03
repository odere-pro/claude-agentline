import { describe, expect, it } from "vitest";

import { gitRun, trimCrlf } from "./invoke.js";

describe("trimCrlf", () => {
  it("strips trailing LF", () => {
    expect(trimCrlf("hello\n")).toBe("hello");
  });

  it("strips trailing CRLF", () => {
    expect(trimCrlf("hello\r\n")).toBe("hello");
  });

  it("strips multiple trailing line endings", () => {
    expect(trimCrlf("a\r\n\r\n")).toBe("a");
  });

  it("preserves embedded newlines", () => {
    expect(trimCrlf("a\nb\n")).toBe("a\nb");
  });

  it("returns empty string unchanged", () => {
    expect(trimCrlf("")).toBe("");
  });
});

describe("gitRun", () => {
  it("returns null for an obviously bogus directory", () => {
    expect(gitRun(["status"], { cwd: "/definitely-not-a-real-path-xyz123" })).toBeNull();
  });

  it("runs against the current repo and returns trimmed output", () => {
    const result = gitRun(["rev-parse", "--is-inside-work-tree"], { cwd: process.cwd() });
    expect(result).toBe("true");
  });

  it("returns null on a bad git command", () => {
    expect(gitRun(["this-is-not-a-git-subcommand"], { cwd: process.cwd() })).toBeNull();
  });
});
