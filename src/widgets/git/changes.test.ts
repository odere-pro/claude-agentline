import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { gitChangesWidget } from "./changes.js";

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

describe("git-changes widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitChangesWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitChangesWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides at zero by default", () => {
    const cell = gitChangesWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders +N -M with git-dirty colour", () => {
    const cell = gitChangesWidget.render(
      makeCtx(makeSnapshot({ diff: { insertions: 12, deletions: 4, filesChanged: 3 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("+12 -4");
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("shows +0 -0 when hideZero=false", () => {
    const cell = gitChangesWidget.render(makeCtx(makeSnapshot()), {
      options: { hideZero: false },
      rawValue: false,
    });
    expect(cell.text).toBe("+0 -0");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({ diff: { insertions: 5, deletions: 2, filesChanged: 1 } });
    const withLabel = gitChangesWidget.render(makeCtx(snap), {
      options: { label: "diff:" },
      rawValue: false,
    });
    const noLabel = gitChangesWidget.render(makeCtx(snap), {
      options: { label: "diff:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("diff:+5 -2");
    expect(noLabel.text).toBe("+5 -2");
  });
});
