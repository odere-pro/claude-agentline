import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { gitBranchWidget } from "./branch.js";

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

describe("git-branch widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitBranchWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitBranchWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the branch name on a clean tree", () => {
    const cell = gitBranchWidget.render(makeCtx(makeSnapshot({ branch: "feature/foo" })), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("feature/foo");
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-clean"]);
  });

  it("uses git-dirty colour when there are staged changes", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 1, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 1 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("uses git-dirty colour when there are unstaged changes", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 0, unstaged: 2, untracked: 0, conflicts: 0, modified: 2, added: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("uses git-dirty colour when there are untracked files", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 0, unstaged: 0, untracked: 3, conflicts: 0, modified: 0, added: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("wraps branch in parentheses on detached HEAD", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ detached: true, branch: "abcdef0" })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("(abcdef0)");
  });

  it("respects custom label", () => {
    const cell = gitBranchWidget.render(makeCtx(makeSnapshot({ branch: "main" })), {
      options: { label: " " },
      rawValue: false,
    });
    expect(cell.text).toBe(" main");
  });

  it("suppresses label when rawValue: true", () => {
    const cell = gitBranchWidget.render(makeCtx(makeSnapshot({ branch: "main" })), {
      options: { label: "branch:" },
      rawValue: true,
    });
    expect(cell.text).toBe("main");
  });
});
