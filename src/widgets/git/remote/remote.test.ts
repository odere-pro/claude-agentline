import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { GitSnapshot, GitState } from "../../../data/git/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";

import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";

import { gitOriginRepoWidget, gitUpstreamWidget } from "./remote.js";

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

describe("git-origin-repo widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitOriginRepoWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitOriginRepoWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when no origin is set", () => {
    const cell = gitOriginRepoWidget.render(makeCtx(makeSnapshot({ origin: null })), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the origin repo name", () => {
    const cell = gitOriginRepoWidget.render(
      makeCtx(makeSnapshot({ origin: { owner: "anthropic", repo: "claude-agentline" } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("claude-agentline");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "claude-agentline" } });
    const noLabel = gitOriginRepoWidget.render(makeCtx(snap), {
      options: { label: "repo:" },
      rawValue: true,
    });
    expect(noLabel.text).toBe("claude-agentline");
  });
});

describe("git-origin-repo widget — host-first workspaceRepo", () => {
  it("prefers ctx.stdin.workspaceRepo.name over origin.repo (default variant)", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "origin-repo" } });
    const ctx = makeCtx(snap, {
      stdin: { raw: {}, truncated: false, workspaceRepo: { name: "host-repo" } },
    });
    const cell = gitOriginRepoWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("host-repo");
  });

  it("falls back to origin.repo when workspaceRepo is absent", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "origin-repo" } });
    const cell = gitOriginRepoWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("origin-repo");
  });

  it("hides when both workspaceRepo and origin are absent", () => {
    const ctx = makeCtx(makeSnapshot({ origin: null }));
    const cell = gitOriginRepoWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders owner/name when the owner-name variant is set and host has both fields", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "origin-repo" } });
    const ctx = makeCtx(snap, {
      stdin: {
        raw: {},
        truncated: false,
        workspaceRepo: { host: "github.com", owner: "odere-pro", name: "agentline" },
      },
    });
    const cell = gitOriginRepoWidget.render(ctx, {
      options: { variant: "owner-name" },
      rawValue: false,
    });
    expect(cell.text).toBe("odere-pro/agentline");
  });

  it("hides on owner-name variant when workspaceRepo owner or name is missing", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "origin-repo" } });
    const ctx = makeCtx(snap, {
      stdin: { raw: {}, truncated: false, workspaceRepo: { name: "agentline" } },
    });
    const cell = gitOriginRepoWidget.render(ctx, {
      options: { variant: "owner-name" },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides on owner-name variant when workspaceRepo is absent", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "origin-repo" } });
    const cell = gitOriginRepoWidget.render(makeCtx(snap), {
      options: { variant: "owner-name" },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });
});

describe("git-upstream widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitUpstreamWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitUpstreamWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when no upstream ref", () => {
    const cell = gitUpstreamWidget.render(makeCtx(makeSnapshot({ upstream: null })), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the upstream ref string", () => {
    const cell = gitUpstreamWidget.render(makeCtx(makeSnapshot({ upstream: "origin/main" })), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("origin/main");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({ upstream: "origin/main" });
    const withLabel = gitUpstreamWidget.render(makeCtx(snap), {
      options: { label: "upstream:" },
      rawValue: false,
    });
    const noLabel = gitUpstreamWidget.render(makeCtx(snap), {
      options: { label: "upstream:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("upstream:origin/main");
    expect(noLabel.text).toBe("origin/main");
  });
});
