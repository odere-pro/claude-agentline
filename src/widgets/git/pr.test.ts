import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { GitSnapshot, GitState } from "../../git/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { gitPrWidget } from "./pr.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeSnapshot(overrides: Partial<GitSnapshot> = {}): GitSnapshot {
  return Object.freeze({
    available: true,
    cwd: "/repo",
    branch: "feat/x",
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
    pr: { number: 42, url: "https://github.com/owner/repo/pull/42", title: "feat: do the thing" },
    ...overrides,
  });
}

function makeCtx(git: GitState | undefined): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-05-13T00:00:00Z"),
    env: {},
    ...(git !== undefined ? { git } : {}),
  };
}

describe("gitPrWidget", () => {
  it("hides when allowNetwork is not set (defense in depth)", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when ctx.git is undefined even with allowNetwork", () => {
    const cell = gitPrWidget.render(makeCtx(undefined), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when the snapshot is unavailable", () => {
    const cell = gitPrWidget.render(makeCtx({ available: false }), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when snapshot.pr is null (gh missing / no PR)", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot({ pr: null })), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders #N by default", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.hidden).not.toBe(true);
    expect(cell.text).toBe("#42");
  });

  it("sets cell.href to the PR url so the rendered PR is clickable", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true },
      rawValue: false,
    });
    expect(cell.href).toBe("https://github.com/owner/repo/pull/42");
  });

  it("renders the URL on the url variant", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true, variant: "url" },
      rawValue: false,
    });
    expect(cell.text).toBe("https://github.com/owner/repo/pull/42");
  });

  it("renders the title on the title variant", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true, variant: "title" },
      rawValue: false,
    });
    expect(cell.text).toBe("feat: do the thing");
  });

  it("renders #N + title on the number-title variant", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true, variant: "number-title" },
      rawValue: false,
    });
    expect(cell.text).toBe("#42 feat: do the thing");
  });

  it("falls back to #N for number-title when the PR has no title", () => {
    const cell = gitPrWidget.render(
      makeCtx(makeSnapshot({ pr: { number: 7, url: "https://x/pull/7", title: "" } })),
      { options: { allowNetwork: true, variant: "number-title" }, rawValue: false },
    );
    expect(cell.text).toBe("#7");
  });

  it("falls back to number for an unknown variant", () => {
    const cell = gitPrWidget.render(makeCtx(makeSnapshot()), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: { allowNetwork: true, variant: "weird" as any },
      rawValue: false,
    });
    expect(cell.text).toBe("#42");
  });

  it("prepends label and suppresses it under rawValue", () => {
    const labelled = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true, label: "PR " },
      rawValue: false,
    });
    expect(labelled.text).toBe("PR #42");
    const raw = gitPrWidget.render(makeCtx(makeSnapshot()), {
      options: { allowNetwork: true, label: "PR " },
      rawValue: true,
    });
    expect(raw.text).toBe("#42");
  });
});
