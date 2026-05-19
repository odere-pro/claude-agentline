import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/index.js";
import type { GitSnapshot, GitState } from "../../data/git/index.js";
import type { StdinPayload } from "../../core/stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { gitUntrackedWidget } from "./status.js";

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

describe("git-untracked widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitUntrackedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides at zero by default", () => {
    const cell = gitUntrackedWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the untracked count", () => {
    const snap = makeSnapshot({
      status: { staged: 0, unstaged: 0, untracked: 5, conflicts: 0, modified: 0, added: 0 },
    });
    const cell = gitUntrackedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("5");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({
      status: { staged: 0, unstaged: 0, untracked: 1, conflicts: 0, modified: 0, added: 0 },
    });
    const withLabel = gitUntrackedWidget.render(makeCtx(snap), {
      options: { label: "?" },
      rawValue: false,
    });
    const noLabel = gitUntrackedWidget.render(makeCtx(snap), {
      options: { label: "?" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("?1");
    expect(noLabel.text).toBe("1");
  });
});
