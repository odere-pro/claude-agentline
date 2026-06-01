import { describe, expect, it } from "vitest";

import { isNewer, parseSemver } from "./semver.js";

describe("parseSemver", () => {
  it("parses a bare triplet", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
  });

  it("tolerates a leading v and strips build metadata", () => {
    expect(parseSemver("v1.2.3+build.5")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: null,
    });
  });

  it("captures the prerelease tag", () => {
    expect(parseSemver("1.2.3-rc.1")?.prerelease).toBe("rc.1");
  });

  it("returns null for unparseable input", () => {
    expect(parseSemver("not-a-version")).toBeNull();
    expect(parseSemver("1.2")).toBeNull();
  });
});

describe("isNewer", () => {
  it("compares the numeric triplet", () => {
    expect(isNewer("0.2.0", "0.1.0")).toBe(true);
    expect(isNewer("0.1.0", "0.2.0")).toBe(false);
    expect(isNewer("1.0.0", "0.9.9")).toBe(true);
  });

  it("treats equal versions as not newer", () => {
    expect(isNewer("1.2.3", "1.2.3")).toBe(false);
  });

  it("ranks a stable release above its prerelease", () => {
    expect(isNewer("1.0.0", "1.0.0-rc.1")).toBe(true);
    expect(isNewer("1.0.0-rc.1", "1.0.0")).toBe(false);
  });

  it("returns false when either side is unparseable", () => {
    expect(isNewer("garbage", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "garbage")).toBe(false);
  });
});
