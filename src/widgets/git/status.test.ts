import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import {
  gitStagedWidget,
  gitStatusWidget,
  gitUnstagedWidget,
  gitUntrackedWidget,
} from "./status.js";

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

describe("git-status widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitStatusWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitStatusWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides on clean tree by default (hideZero=true)", () => {
    const cell = gitStatusWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders 'clean' with git-clean colour when hideZero=false and tree is clean", () => {
    const cell = gitStatusWidget.render(makeCtx(makeSnapshot()), {
      options: { hideZero: false },
      rawValue: false,
    });
    expect(cell.text).toBe("clean");
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-clean"]);
  });

  it("renders compact M/A/? summary with git-dirty colour", () => {
    const snap = makeSnapshot({
      status: { staged: 2, unstaged: 1, untracked: 3, conflicts: 0, modified: 1, added: 1 },
    });
    const cell = gitStatusWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("M1 A1 ?3");
    expect(cell.fg).toBe(DEFAULT_PALETTE["git-dirty"]);
  });

  it("includes conflicts as U segment", () => {
    const snap = makeSnapshot({
      status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 2, modified: 0, added: 0 },
    });
    const cell = gitStatusWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("U2");
  });

  it("elides zero-count segments", () => {
    const snap = makeSnapshot({
      status: { staged: 1, unstaged: 0, untracked: 2, conflicts: 0, modified: 0, added: 1 },
    });
    const cell = gitStatusWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("A1 ?2");
    expect(cell.text).not.toMatch(/M0/);
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({
      status: { staged: 1, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 1 },
    });
    const withLabel = gitStatusWidget.render(makeCtx(snap), {
      options: { label: "st:" },
      rawValue: false,
    });
    const noLabel = gitStatusWidget.render(makeCtx(snap), {
      options: { label: "st:" },
      rawValue: true,
    });
    expect(withLabel.text).toMatch(/^st:/);
    expect(noLabel.text).not.toMatch(/^st:/);
  });
});

describe("git-staged widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitStagedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides at zero by default", () => {
    const cell = gitStagedWidget.render(makeCtx(makeSnapshot()), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the staged count", () => {
    const snap = makeSnapshot({
      status: { staged: 3, unstaged: 0, untracked: 0, conflicts: 0, modified: 0, added: 3 },
    });
    const cell = gitStagedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("3");
  });

  it("shows 0 when hideZero=false", () => {
    const cell = gitStagedWidget.render(makeCtx(makeSnapshot()), {
      options: { hideZero: false },
      rawValue: false,
    });
    expect(cell.text).toBe("0");
  });
});

describe("git-unstaged widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitUnstagedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides at zero by default", () => {
    const cell = gitUnstagedWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the unstaged count", () => {
    const snap = makeSnapshot({
      status: { staged: 0, unstaged: 2, untracked: 0, conflicts: 0, modified: 2, added: 0 },
    });
    const cell = gitUnstagedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("2");
  });
});

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
