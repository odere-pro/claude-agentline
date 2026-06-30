/**
 * Unit tests for `parseGitFixture` — the one shared deserializer that both
 * the source golden harness (`__golden__.test.ts`) and the bin's
 * `render --fixture --git <path>` read a scenario's `git.json` through, so
 * they inject byte-identical snapshots (issue #255, parity by construction).
 */

import { describe, expect, it } from "vitest";

import { makeGitSnapshot } from "../../../test-helpers/index.js";

import { parseGitFixture } from "./parse-git-fixture.js";

const HOST_PR_SNAPSHOT = makeGitSnapshot({
  pr: { number: 42, url: "https://example.test/pull/42", title: "" },
  prSource: "host",
});

describe("parseGitFixture", () => {
  it("parses a serialized available snapshot into a frozen GitState", () => {
    const git = parseGitFixture(JSON.stringify(HOST_PR_SNAPSHOT));
    expect(git.available).toBe(true);
    // Mirrors the live loader, which freezes the snapshot it returns.
    expect(Object.isFrozen(git)).toBe(true);
    if (git.available) {
      expect(git.pr?.number).toBe(42);
      expect(git.prSource).toBe("host");
    }
  });

  it("parses an unavailable snapshot", () => {
    const git = parseGitFixture(JSON.stringify({ available: false }));
    expect(git.available).toBe(false);
    expect(Object.isFrozen(git)).toBe(true);
  });

  it("strips reserved prototype keys at the parse boundary (D-010)", () => {
    const git = parseGitFixture('{ "available": false, "__proto__": { "polluted": true } }');
    expect(git.available).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGitFixture("{ not json")).toThrow();
  });

  it("fails loud when `available` is missing or not a boolean", () => {
    expect(() => parseGitFixture(JSON.stringify({ available: "yes" }))).toThrow(/available/);
    expect(() => parseGitFixture(JSON.stringify({ branch: "main" }))).toThrow(/available/);
  });

  it("throws on a non-object top-level value", () => {
    expect(() => parseGitFixture("42")).toThrow(/available/);
    expect(() => parseGitFixture("null")).toThrow(/available/);
  });

  it("fails loud on a partial available snapshot (missing sub-object) instead of crashing a widget", () => {
    // A snapshot whose `diff` is absent would throw inside git-changes
    // (`snap.diff.insertions`) and blank the whole line; catch it here.
    const partial = { ...HOST_PR_SNAPSHOT, diff: undefined };
    expect(() => parseGitFixture(JSON.stringify(partial))).toThrow(/`diff`/);
  });

  it("fails loud when `pr` is set but `prSource` is null", () => {
    const inconsistent = { ...HOST_PR_SNAPSHOT, prSource: null };
    expect(() => parseGitFixture(JSON.stringify(inconsistent))).toThrow(/prSource/);
  });
});
