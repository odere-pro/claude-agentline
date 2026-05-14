import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";

import { gitAheadBehindWidget, gitConflictsWidget } from "./ahead-behind.js";
import { gitBranchWidget } from "./branch.js";
import { gitChangesWidget } from "./changes.js";
import { gitOriginRepoWidget, gitUpstreamWidget } from "./remote.js";
import { gitShaWidget, gitWorktreeWidget } from "./sha.js";
import {
  gitStagedWidget,
  gitUnstagedWidget,
  gitUntrackedWidget,
} from "./status.js";
import { GIT_WIDGETS, registerGitWidgets } from "./index.js";

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

describe("registerGitWidgets", () => {
  it("ships exactly 12 widgets in sorted order", () => {
    const r = new WidgetRegistry();
    registerGitWidgets(r);
    expect(r.size()).toBe(12);
    expect(r.list()).toEqual([
      "git-ahead-behind",
      "git-branch",
      "git-changes",
      "git-conflicts",
      "git-origin-repo",
      "git-pr",
      "git-sha",
      "git-staged",
      "git-unstaged",
      "git-untracked",
      "git-upstream",
      "git-worktree",
    ]);
    expect(Object.isFrozen(GIT_WIDGETS)).toBe(true);
    expect(GIT_WIDGETS).toHaveLength(12);
  });

  it("hides every widget when ctx.git is missing", () => {
    const ctx = makeCtx(undefined);
    for (const def of GIT_WIDGETS) {
      const cell = def.render(ctx, { options: {}, rawValue: false });
      expect(cell.hidden, `${def.type} should hide`).toBe(true);
    }
  });

  it("hides every widget when ctx.git is unavailable", () => {
    const ctx = makeCtx({ available: false });
    for (const def of GIT_WIDGETS) {
      const cell = def.render(ctx, { options: {}, rawValue: false });
      expect(cell.hidden, `${def.type} should hide`).toBe(true);
    }
  });
});

describe("git-branch widget", () => {
  it("renders the branch name with the clean role colour", () => {
    const cell = gitBranchWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("main");
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-clean"]);
  });

  it("uses the dirty role when there are staged changes", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 1, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 1 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("uses the dirty role when there are unstaged changes", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 0, unstaged: 2, untracked: 0, conflicts: 0, modified: 2, added: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("uses the dirty role when there are untracked files", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 0, unstaged: 0, untracked: 3, conflicts: 0, modified: 0, added: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("wraps the SHA in parentheses on detached HEAD", () => {
    const cell = gitBranchWidget.render(
      makeCtx(makeSnapshot({ detached: true, branch: "abcdef0" })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("(abcdef0)");
  });

  it("honours options.label and rawValue strips it", () => {
    const snap = makeSnapshot({ branch: "main" });
    const withLabel = gitBranchWidget.render(makeCtx(snap), {
      options: { label: " " },
      rawValue: false,
    });
    const noLabel = gitBranchWidget.render(makeCtx(snap), {
      options: { label: "branch:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe(" main");
    expect(noLabel.text).toBe("main");
  });
});

describe("git-changes widget", () => {
  const dirty = makeSnapshot({ diff: { insertions: 12, deletions: 4, filesChanged: 3 } });

  it("git-changes renders +N -M", () => {
    const cell = gitChangesWidget.render(makeCtx(dirty), { options: {}, rawValue: false });
    expect(cell.text).toBe("+12 -4");
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("hides at zero by default", () => {
    expect(
      gitChangesWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("hideZero=false keeps the widget visible at zero", () => {
    const cell = gitChangesWidget.render(makeCtx(makeSnapshot()), {
      options: { hideZero: false },
      rawValue: false,
    });
    expect(cell.text).toBe("+0 -0");
  });

  it("honours options.label and rawValue strips it", () => {
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

describe("git-staged / -unstaged / -untracked widgets", () => {
  const dirty = makeSnapshot({
    status: { staged: 2, unstaged: 1, untracked: 3, conflicts: 0, modified: 1, added: 1 },
  });

  it("count widgets render their number", () => {
    expect(
      gitStagedWidget.render(makeCtx(dirty), { options: {}, rawValue: false }).text,
    ).toBe("2");
    expect(
      gitUnstagedWidget.render(makeCtx(dirty), { options: {}, rawValue: false }).text,
    ).toBe("1");
    expect(
      gitUntrackedWidget.render(makeCtx(dirty), { options: {}, rawValue: false }).text,
    ).toBe("3");
  });

  it("count widgets hide at zero by default", () => {
    expect(
      gitStagedWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });
});

describe("git-ahead-behind widget", () => {
  it("hides without an upstream ref", () => {
    expect(
      gitAheadBehindWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false })
        .hidden,
    ).toBe(true);
  });

  it("hides when ahead and behind are both zero (default)", () => {
    expect(
      gitAheadBehindWidget.render(
        makeCtx(makeSnapshot({ upstream: "origin/main" })),
        { options: {}, rawValue: false },
      ).hidden,
    ).toBe(true);
  });

  it("renders ↑N when ahead", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 3, behind: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("↑3");
  });

  it("renders both segments when both are non-zero", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 2, behind: 5 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("↑2 ↓5");
  });

  it("hideEven=false keeps the widget visible at parity", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main" })),
      { options: { hideEven: false }, rawValue: false },
    );
    expect(cell.text).toBe("↑0 ↓0");
  });
});

describe("git-conflicts widget", () => {
  it("hides at zero", () => {
    expect(
      gitConflictsWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("renders ⚡N with the danger role", () => {
    const cell = gitConflictsWidget.render(
      makeCtx(makeSnapshot({ status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 2, modified: 0, added: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("⚡2");
    expect(cell.fg).toBe(DEFAULT_PALETTE.danger);
  });
});

describe("git-sha widget", () => {
  it("renders the 7-char short SHA by default", () => {
    const cell = gitShaWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false });
    expect(cell.text).toBe("abcdef0");
  });

  it("respects options.length up to 40", () => {
    const cell = gitShaWidget.render(makeCtx(makeSnapshot()), {
      options: { length: 12 },
      rawValue: false,
    });
    expect(cell.text).toBe("abcdef012345");
    expect(cell.text.length).toBe(12);
  });
});

describe("git-worktree widget", () => {
  it("hides when not in a worktree", () => {
    expect(
      gitWorktreeWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("renders the worktree name when set", () => {
    const cell = gitWorktreeWidget.render(
      makeCtx(makeSnapshot({ inWorktree: true, worktreeName: "feature-x" })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("feature-x");
  });
});

describe("git-origin-repo widget", () => {
  const withOrigin = makeSnapshot({ origin: { owner: "odere-pro", repo: "claude-agentline" } });

  it("renders the repo segment", () => {
    expect(
      gitOriginRepoWidget.render(makeCtx(withOrigin), { options: {}, rawValue: false }).text,
    ).toBe("claude-agentline");
  });

  it("hides without an origin", () => {
    expect(
      gitOriginRepoWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false })
        .hidden,
    ).toBe(true);
  });
});

describe("git-upstream widget", () => {
  it("renders the upstream ref", () => {
    const cell = gitUpstreamWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main" })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("origin/main");
  });

  it("hides without one", () => {
    expect(
      gitUpstreamWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });
});
