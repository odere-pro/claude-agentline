import { describe, expect, it } from "vitest";

import { loadPullRequest, parsePullRequestJson } from "./pr.js";

describe("parsePullRequestJson", () => {
  it("returns the typed shape for a well-formed payload", () => {
    const out = parsePullRequestJson(
      '{"number":42,"url":"https://github.com/o/r/pull/42","title":"feat: x"}',
    );
    expect(out).toEqual({
      number: 42,
      url: "https://github.com/o/r/pull/42",
      title: "feat: x",
    });
  });

  it("freezes the returned object", () => {
    const out = parsePullRequestJson('{"number":1,"url":"https://x/pull/1","title":"t"}');
    expect(Object.isFrozen(out)).toBe(true);
  });

  it("ignores extra fields", () => {
    const out = parsePullRequestJson(
      '{"number":1,"url":"https://x/pull/1","title":"t","extra":"ignored","author":{"login":"x"}}',
    );
    expect(out).toEqual({ number: 1, url: "https://x/pull/1", title: "t" });
  });

  it("floors a non-integer PR number", () => {
    const out = parsePullRequestJson('{"number":42.7,"url":"https://x/pull/42","title":"t"}');
    expect(out?.number).toBe(42);
  });

  it("rejects empty / non-string input", () => {
    expect(parsePullRequestJson("")).toBeNull();
    expect(parsePullRequestJson("   ")).toBeNull();
    // @ts-expect-error testing runtime guard
    expect(parsePullRequestJson(undefined)).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(parsePullRequestJson("{not json")).toBeNull();
  });

  it("rejects payloads with the wrong shape", () => {
    expect(parsePullRequestJson("null")).toBeNull();
    expect(parsePullRequestJson("[]")).toBeNull();
    expect(parsePullRequestJson('{"number":"42","url":"u","title":"t"}')).toBeNull();
    expect(parsePullRequestJson('{"number":42,"url":"","title":"t"}')).toBeNull();
    expect(parsePullRequestJson('{"number":0,"url":"u","title":"t"}')).toBeNull();
    expect(parsePullRequestJson('{"number":-3,"url":"u","title":"t"}')).toBeNull();
    expect(parsePullRequestJson('{"number":42,"url":"u"}')).toBeNull(); // missing title
    expect(parsePullRequestJson('{"number":42,"url":"u","title":42}')).toBeNull();
  });
});

describe("loadPullRequest", () => {
  it("returns null when invoked against a directory `gh` cannot resolve", () => {
    /*
     * We don't assume `gh` is installed on the test host. Either path —
     * `gh` missing entirely, or `gh` running but failing to find a PR for
     * the temp directory — the loader must swallow and return null.
     */
    const out = loadPullRequest({ cwd: "/tmp", timeoutMs: 250 });
    expect(out).toBeNull();
  });
});
