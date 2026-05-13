import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { gitShaWidget, gitWorktreeWidget } from "./sha.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeSnapshot(overrides: Partial<GitSnapshot> = {}): GitSnapshot {
  return Object.freeze({
    available: true,
    cwd: "/repo",
    branch: "main",
    detached: false,
    sha: "abcdef0123456789abcdef0123456789abcdef01",
    shortSha: "abcdef0",
    status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 0 },
    diff: { insertions: 0, deletions: 0, filesChanged: 0 },
    diffStaged: { insertions: 0, deletions: 0, filesChanged: 0 },
    aheadBehind: { ahead: 0, behind: 0 },
    upstream: null,
    origin: null,
    upstreamRemote: null,
    worktreeName: null,
    inWorktree: false,
    pr: null,
    ...overrides,
  });
}

function makeCtx(git: GitState | undefined, overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-05-01T00:00:00Z"),
    env: {},
    git,
    ...overrides,
  };
}

describe("git-sha widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitShaWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitShaWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the 7-character short SHA by default", () => {
    const cell = gitShaWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false });
    expect(cell.text).toBe("abcdef0");
    expect(cell.text.length).toBe(7);
  });

  it("respects options.length up to 40", () => {
    const cell = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { length: 12 },
      rawValue: false,
    });
    expect(cell.text).toBe("abcdef012345");
    expect(cell.text.length).toBe(12);
  });

  it("clamps options.length to 40", () => {
    const cell = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { length: 100 },
      rawValue: false,
    });
    expect(cell.text.length).toBe(40);
  });

  it("falls back to 7 for invalid options.length", () => {
    const cellNeg = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { length: -1 },
      rawValue: false,
    });
    expect(cellNeg.text.length).toBe(7);

    const cellZero = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { length: 0 },
      rawValue: false,
    });
    expect(cellZero.text.length).toBe(7);
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { label: "sha:" },
      rawValue: false,
    });
    const noLabel = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { label: "sha:" },
      rawValue: true,
    });
    expect(withLabel.text).toMatch(/^sha:/);
    expect(noLabel.text).not.toMatch(/^sha:/);
  });
});

describe("git-worktree widget", () => {
  it("hides when not in a worktree", () => {
    const cell = gitWorktreeWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git is absent", () => {
    const cell = gitWorktreeWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitWorktreeWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the worktree name when set", () => {
    const cell = gitWorktreeWidget.render(
      makeCtx(makeSnapshot({ inWorktree: true, worktreeName: "my-worktree" })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("my-worktree");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = gitWorktreeWidget.render(
      makeCtx(makeSnapshot({ inWorktree: true, worktreeName: "wt-a" })),
      { options: { label: "wt:" }, rawValue: false },
    );
    const noLabel = gitWorktreeWidget.render(
      makeCtx(makeSnapshot({ inWorktree: true, worktreeName: "wt-a" })),
      { options: { label: "wt:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("wt:wt-a");
    expect(noLabel.text).toBe("wt-a");
  });
});
