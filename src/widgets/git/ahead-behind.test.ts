import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { gitAheadBehindWidget, gitConflictsWidget } from "./ahead-behind.js";

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

describe("git-ahead-behind widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitAheadBehindWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitAheadBehindWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when no upstream is set", () => {
    const cell = gitAheadBehindWidget.render(makeCtx(makeSnapshot({ upstream: null })), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ahead and behind are both zero by default", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 0, behind: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("renders ↑N when only ahead", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 3, behind: 0 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("↑3");
  });

  it("renders ↓N when only behind", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 0, behind: 2 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("↓2");
  });

  it("renders both segments when ahead and behind are non-zero", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 2, behind: 5 } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("↑2 ↓5");
  });

  it("hideEven=false keeps the widget visible at parity", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 0, behind: 0 } })),
      { options: { hideEven: false }, rawValue: false },
    );
    expect(cell.hidden).not.toBe(true);
    expect(cell.text).toBe("↑0 ↓0");
  });

  it("respects custom aheadGlyph and behindGlyph", () => {
    const cell = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 1, behind: 2 } })),
      { options: { aheadGlyph: "+", behindGlyph: "-" }, rawValue: false },
    );
    expect(cell.text).toBe("+1 -2");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 1, behind: 0 } })),
      { options: { label: "ab:" }, rawValue: false },
    );
    const noLabel = gitAheadBehindWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main", aheadBehind: { ahead: 1, behind: 0 } })),
      { options: { label: "ab:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("ab:↑1");
    expect(noLabel.text).toBe("↑1");
  });
});

describe("git-conflicts widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitConflictsWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitConflictsWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides at zero conflicts", () => {
    const cell = gitConflictsWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders ⚡N with the danger role colour", () => {
    const cell = gitConflictsWidget.render(
      makeCtx(makeSnapshot({
        status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 2, modified: 0, added: 0 },
      })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("⚡2");
    expect(cell.fg).toBe(DEFAULT_PALETTE.danger);
  });

  it("respects custom glyph option", () => {
    const cell = gitConflictsWidget.render(
      makeCtx(makeSnapshot({
        status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 1, modified: 0, added: 0 },
      })),
      { options: { glyph: "!" }, rawValue: false },
    );
    expect(cell.text).toBe("!1");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = gitConflictsWidget.render(
      makeCtx(makeSnapshot({
        status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 3, modified: 0, added: 0 },
      })),
      { options: { label: "cf:" }, rawValue: false },
    );
    const noLabel = gitConflictsWidget.render(
      makeCtx(makeSnapshot({
        status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 3, modified: 0, added: 0 },
      })),
      { options: { label: "cf:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("cf:⚡3");
    expect(noLabel.text).toBe("⚡3");
  });
});
