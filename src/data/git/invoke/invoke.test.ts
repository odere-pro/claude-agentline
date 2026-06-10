import { describe, expect, it } from "vitest";

import { gitRun, gitRunOutcome, trimCrlf } from "./invoke.js";

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

describe("gitRunOutcome", () => {
  it("reports ok with trimmed stdout on success", () => {
    const outcome = gitRunOutcome(["rev-parse", "--is-inside-work-tree"], { cwd: process.cwd() });
    expect(outcome).toEqual({ ok: true, value: "true" });
  });

  it("classifies a non-zero git exit as a genuine 'exit'", () => {
    // `@{upstream}` of a ref with no upstream exits non-zero — git ran and
    // answered "no", which must NOT be treated as a transient miss.
    const outcome = gitRunOutcome(["rev-parse", "--abbrev-ref", "no-such-ref@{upstream}"], {
      cwd: process.cwd(),
    });
    expect(outcome).toEqual({ ok: false, reason: "exit" });
  });

  it("classifies a missing binary / spawn failure as 'transient'", () => {
    // A cwd that does not exist makes the spawn fail before git can exit
    // with a status code — that surfaces as a spawn error, not an exit.
    const outcome = gitRunOutcome(["status"], { cwd: "/definitely-not-a-real-path-xyz123" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("transient");
  });

  it("classifies a timeout as 'transient'", () => {
    // A 0ms timeout forces the kill path (SIGTERM, no exit status).
    const outcome = gitRunOutcome(["rev-parse", "HEAD"], { cwd: process.cwd(), timeoutMs: 1 });
    if (!outcome.ok) expect(outcome.reason).toBe("transient");
  });
});
