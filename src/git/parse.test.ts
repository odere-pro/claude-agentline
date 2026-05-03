import { describe, expect, it } from "vitest";

import {
  parseAheadBehind,
  parsePorcelain,
  parseRemoteUrl,
  parseShortstat,
} from "./parse.js";

describe("parsePorcelain", () => {
  it("returns zeros for null / empty input", () => {
    expect(parsePorcelain(null)).toMatchObject({
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicts: 0,
    });
    expect(parsePorcelain("")).toMatchObject({ staged: 0 });
  });

  it("counts untracked, modified, added, conflicts", () => {
    const input = [
      "?? new.txt",
      " M tracked.txt",
      "M  staged.txt",
      "A  add.txt",
      "MM both.txt",
      "UU conflict.txt",
      "AA other.txt",
    ].join("\n");
    const r = parsePorcelain(input);
    expect(r).toMatchObject({
      staged: 3, // staged.txt (M_), add.txt (A_), both.txt (M_)
      unstaged: 2, // tracked.txt (_M), both.txt (_M)
      untracked: 1,
      conflicts: 2,
      modified: 3, // tracked.txt, staged.txt, both.txt
      added: 1,
    });
  });
});

describe("parseAheadBehind", () => {
  it("zero shape on empty", () => {
    expect(parseAheadBehind(null)).toEqual({ ahead: 0, behind: 0 });
    expect(parseAheadBehind("")).toEqual({ ahead: 0, behind: 0 });
  });

  it("parses tab-separated counts (left=behind, right=ahead)", () => {
    expect(parseAheadBehind("2\t5")).toEqual({ ahead: 5, behind: 2 });
    expect(parseAheadBehind("0  3")).toEqual({ ahead: 3, behind: 0 });
  });

  it("ignores garbage", () => {
    expect(parseAheadBehind("not a number")).toEqual({ ahead: 0, behind: 0 });
  });
});

describe("parseShortstat", () => {
  it("zero shape on empty", () => {
    expect(parseShortstat(null)).toEqual({
      insertions: 0,
      deletions: 0,
      filesChanged: 0,
    });
  });

  it("parses standard --shortstat output", () => {
    const r = parseShortstat(" 3 files changed, 12 insertions(+), 4 deletions(-)");
    expect(r).toEqual({ filesChanged: 3, insertions: 12, deletions: 4 });
  });

  it("handles single-file singular form", () => {
    const r = parseShortstat(" 1 file changed, 1 insertion(+)");
    expect(r).toEqual({ filesChanged: 1, insertions: 1, deletions: 0 });
  });
});

describe("parseRemoteUrl", () => {
  it("ssh form: git@github.com:owner/repo.git", () => {
    expect(parseRemoteUrl("git@github.com:odere-pro/claude-agentline.git")).toEqual({
      owner: "odere-pro",
      repo: "claude-agentline",
    });
  });

  it("https form", () => {
    expect(parseRemoteUrl("https://github.com/odere-pro/claude-agentline.git")).toEqual({
      owner: "odere-pro",
      repo: "claude-agentline",
    });
  });

  it("https form without .git suffix", () => {
    expect(parseRemoteUrl("https://github.com/o/r")).toEqual({ owner: "o", repo: "r" });
  });

  it("ssh:// scheme", () => {
    expect(parseRemoteUrl("ssh://git@github.com/o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    });
  });

  it("returns null on undecodable input", () => {
    expect(parseRemoteUrl(null)).toBeNull();
    expect(parseRemoteUrl("")).toBeNull();
    expect(parseRemoteUrl("just-a-name")).toBeNull();
  });
});
