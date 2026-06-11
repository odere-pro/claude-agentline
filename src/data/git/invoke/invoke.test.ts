import { describe, expect, it } from "vitest";

import { classifyGitFailure, gitRun, gitRunOutcome, trimCrlf } from "./invoke.js";

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
});

describe("classifyGitFailure", () => {
  it("treats a numeric exit status as a genuine 'exit'", () => {
    expect(classifyGitFailure({ status: 128, signal: null })).toBe("exit");
  });

  it("treats a SIGTERM kill (timeout) as 'transient'", () => {
    expect(classifyGitFailure({ status: null, signal: "SIGTERM", code: "ETIMEDOUT" })).toBe(
      "transient",
    );
  });

  it("treats a kill that also reports a status as 'transient' (signal wins)", () => {
    // Some platforms/Node versions surface both on a timeout kill; the
    // signal must take precedence so the timeout isn't read as a real exit.
    expect(classifyGitFailure({ status: 143, signal: "SIGTERM", killed: true })).toBe("transient");
  });

  it("treats killed:true as 'transient' even without a signal", () => {
    expect(classifyGitFailure({ status: 1, killed: true })).toBe("transient");
  });

  it("treats a spawn failure (ENOENT) as 'transient'", () => {
    expect(classifyGitFailure({ code: "ENOENT", status: null })).toBe("transient");
  });

  it("treats an unknown/empty error as 'transient'", () => {
    expect(classifyGitFailure({})).toBe("transient");
    expect(classifyGitFailure(undefined)).toBe("transient");
  });
});
