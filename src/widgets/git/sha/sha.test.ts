import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { GitSnapshot, GitState } from "../../../data/git/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";

import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";

import { gitWorktreeWidget } from "./sha.js";

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
    prSource: null,
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
