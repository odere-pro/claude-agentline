import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import {
  gitIsForkWidget,
  gitOriginOwnerWidget,
  gitOriginRepoWidget,
  gitUpstreamWidget,
} from "./remote.js";

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

describe("git-origin-owner widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitOriginOwnerWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitOriginOwnerWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when no origin is set", () => {
    const cell = gitOriginOwnerWidget.render(makeCtx(makeSnapshot({ origin: null })), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders the origin owner", () => {
    const cell = gitOriginOwnerWidget.render(
      makeCtx(makeSnapshot({ origin: { owner: "anthropic", repo: "claude" } })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("anthropic");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({ origin: { owner: "anthropic", repo: "claude" } });
    const withLabel = gitOriginOwnerWidget.render(makeCtx(snap), {
      options: { label: "owner:" },
      rawValue: false,
    });
    const noLabel = gitOriginOwnerWidget.render(makeCtx(snap), {
      options: { label: "owner:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("owner:anthropic");
    expect(noLabel.text).toBe("anthropic");
  });
});

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
    const cell = gitUpstreamWidget.render(
      makeCtx(makeSnapshot({ upstream: "origin/main" })),
      { options: {}, rawValue: false },
    );
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

describe("git-is-fork widget", () => {
  it("hides when ctx.git is absent", () => {
    const cell = gitIsForkWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git.available is false", () => {
    const cell = gitIsForkWidget.render(makeCtx({ available: false }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides without an upstream remote", () => {
    const cell = gitIsForkWidget.render(
      makeCtx(makeSnapshot({ origin: { owner: "fork", repo: "r" }, upstreamRemote: null })),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("reports 'fork' when origin owner differs from upstream owner", () => {
    const cell = gitIsForkWidget.render(
      makeCtx(makeSnapshot({
        origin: { owner: "fork-owner", repo: "r" },
        upstreamRemote: { owner: "anthropic", repo: "r" },
      })),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("fork");
  });

  it("hides when origin owner equals upstream owner (not a fork)", () => {
    const cell = gitIsForkWidget.render(
      makeCtx(makeSnapshot({
        origin: { owner: "anthropic", repo: "r" },
        upstreamRemote: { owner: "anthropic", repo: "r" },
      })),
      { options: {}, rawValue: false },
    );
    expect(cell.hidden).toBe(true);
  });

  it("honours custom forkText option", () => {
    const cell = gitIsForkWidget.render(
      makeCtx(makeSnapshot({
        origin: { owner: "a", repo: "r" },
        upstreamRemote: { owner: "b", repo: "r" },
      })),
      { options: { forkText: "FORK" }, rawValue: false },
    );
    expect(cell.text).toBe("FORK");
  });

  it("honours custom notForkText option (renders when same owner)", () => {
    const cell = gitIsForkWidget.render(
      makeCtx(makeSnapshot({
        origin: { owner: "anthropic", repo: "r" },
        upstreamRemote: { owner: "anthropic", repo: "r" },
      })),
      { options: { notForkText: "source" }, rawValue: false },
    );
    expect(cell.text).toBe("source");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot({
      origin: { owner: "a", repo: "r" },
      upstreamRemote: { owner: "b", repo: "r" },
    });
    const withLabel = gitIsForkWidget.render(makeCtx(snap), {
      options: { label: "is:" },
      rawValue: false,
    });
    const noLabel = gitIsForkWidget.render(makeCtx(snap), {
      options: { label: "is:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("is:fork");
    expect(noLabel.text).toBe("fork");
  });
});
