/**
 * Unit tests for `loadLiveSnapshots` — specifically the `allowPullRequest`
 * threading logic (Bug 4 / P0).
 *
 * The tests mock `loadGitSnapshot` at the module boundary to assert that:
 *   (a) the default path (no git-pr widget with allowNetwork) calls the
 *       snapshot loader WITHOUT `allowPullRequest` — gate-14 is green.
 *   (b) a config containing a git-pr widget whose `options.allowNetwork`
 *       is `true` calls the snapshot loader WITH `allowPullRequest: true`.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import type { AgentlineConfig, WidgetConfig } from "../../data/config/types.js";
import type { GitSnapshot } from "../../data/git/snapshot/snapshot.js";
import { saveGitSnapshot } from "../../data/state/git-snapshot-cache/git-snapshot-cache.js";
import { makeStdinPayload } from "../../test-helpers/index.js";

// --------------------------------------------------------------------------
// The module under test re-exports `loadGitSnapshot` via a named import.
// We mock the snapshot module so no real git process is spawned and we can
// capture the exact arguments passed.
// --------------------------------------------------------------------------

vi.mock("../../data/git/snapshot/snapshot.js", () => ({
  loadGitSnapshot: vi.fn(() => ({ available: false })),
}));

// Import AFTER the mock is registered so the module gets the mocked version.
import { loadLiveSnapshots } from "./context.js";
import { loadGitSnapshot } from "../../data/git/snapshot/snapshot.js";

const mockLoadGitSnapshot = loadGitSnapshot as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigWithGitPr(allowNetwork: boolean): AgentlineConfig {
  const prWidget: WidgetConfig = {
    type: "git-pr",
    options: { allowNetwork },
  };
  return {
    ...DEFAULT_CONFIG,
    lines: [{ widgets: [prWidget] }],
  };
}

function makeConfigNoGitPr(): AgentlineConfig {
  const branchWidget: WidgetConfig = { type: "git-branch" };
  return {
    ...DEFAULT_CONFIG,
    lines: [{ widgets: [branchWidget] }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadLiveSnapshots — allowPullRequest threading", () => {
  const payload = makeStdinPayload({ cwd: "/repo" });

  beforeEach(() => {
    mockLoadGitSnapshot.mockClear();
    mockLoadGitSnapshot.mockReturnValue({ available: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("(a) default config — loadGitSnapshot called WITHOUT allowPullRequest", () => {
    loadLiveSnapshots(payload, { config: DEFAULT_CONFIG });
    expect(mockLoadGitSnapshot).toHaveBeenCalledOnce();
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    // allowPullRequest must be absent or falsy so no gh subprocess is spawned
    expect(callArg?.allowPullRequest).toBeFalsy();
  });

  it("(a) config with git-pr but allowNetwork:false — NOT allowPullRequest", () => {
    loadLiveSnapshots(payload, { config: makeConfigWithGitPr(false) });
    expect(mockLoadGitSnapshot).toHaveBeenCalledOnce();
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.allowPullRequest).toBeFalsy();
  });

  it("(a) config without any git-pr widget — NOT allowPullRequest", () => {
    loadLiveSnapshots(payload, { config: makeConfigNoGitPr() });
    expect(mockLoadGitSnapshot).toHaveBeenCalledOnce();
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.allowPullRequest).toBeFalsy();
  });

  it("(b) config with git-pr + allowNetwork:true — allowPullRequest:true passed", () => {
    loadLiveSnapshots(payload, { config: makeConfigWithGitPr(true) });
    expect(mockLoadGitSnapshot).toHaveBeenCalledOnce();
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.allowPullRequest).toBe(true);
  });

  it("(b) git-pr in a second line with allowNetwork:true — allowPullRequest:true passed", () => {
    const config: AgentlineConfig = {
      ...DEFAULT_CONFIG,
      lines: [
        { widgets: [{ type: "git-branch" }] },
        { widgets: [{ type: "git-pr", options: { allowNetwork: true } }] },
      ],
    };
    loadLiveSnapshots(payload, { config });
    expect(mockLoadGitSnapshot).toHaveBeenCalledOnce();
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.allowPullRequest).toBe(true);
  });

  it("omitting config option behaves like no opt-in (backward compat)", () => {
    loadLiveSnapshots(payload);
    expect(mockLoadGitSnapshot).toHaveBeenCalledOnce();
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.allowPullRequest).toBeFalsy();
  });
});

describe("loadLiveSnapshots — hostPr threading", () => {
  beforeEach(() => {
    mockLoadGitSnapshot.mockClear();
    mockLoadGitSnapshot.mockReturnValue({ available: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes hostPr to loadGitSnapshot when payload.pr has a valid number and url", () => {
    const payload = makeStdinPayload({
      cwd: "/repo",
      pr: { number: 244, url: "https://github.com/odere-pro/agentline/pull/244" },
    });
    loadLiveSnapshots(payload);
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.hostPr).toEqual({
      number: 244,
      url: "https://github.com/odere-pro/agentline/pull/244",
    });
  });

  it("omits hostPr when payload.pr is absent", () => {
    const payload = makeStdinPayload({ cwd: "/repo" });
    loadLiveSnapshots(payload);
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.hostPr).toBeUndefined();
  });

  it("omits hostPr when pr.number is zero (malformed)", () => {
    const payload = makeStdinPayload({
      cwd: "/repo",
      pr: { number: 0, url: "https://github.com/foo/bar/pull/0" },
    });
    loadLiveSnapshots(payload);
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.hostPr).toBeUndefined();
  });

  it("omits hostPr when pr.url is empty string (malformed)", () => {
    const payload = makeStdinPayload({
      cwd: "/repo",
      pr: { number: 5, url: "" },
    });
    loadLiveSnapshots(payload);
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.hostPr).toBeUndefined();
  });

  it("omits hostPr when pr.url is absent (only number present)", () => {
    const payload = makeStdinPayload({ cwd: "/repo", pr: { number: 7 } });
    loadLiveSnapshots(payload);
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.hostPr).toBeUndefined();
  });

  it("omits hostPr when pr.number is a float (not an integer)", () => {
    // Even if the adapter already rejects floats, context.ts must guard independently.
    const payload = makeStdinPayload({
      cwd: "/repo",
      pr: { number: 3.7, url: "https://github.com/foo/bar/pull/3" },
    });
    loadLiveSnapshots(payload);
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.hostPr).toBeUndefined();
  });
});

describe("loadLiveSnapshots — last-known-good threading", () => {
  let tmp: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    mockLoadGitSnapshot.mockClear();
    mockLoadGitSnapshot.mockReturnValue({ available: false });
    tmp = mkdtempSync(join(tmpdir(), "agentline-ctx-cache-"));
    env = { CLAUDE_CONFIG_DIR: tmp };
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("passes the cached snapshot as `previous` when one exists for the cwd", async () => {
    const cached: GitSnapshot = Object.freeze({
      available: true,
      cwd: "/repo",
      branch: "feature-x",
      detached: false,
      sha: "b".repeat(40),
      shortSha: "bbbbbbb",
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
    });
    await saveGitSnapshot(cached, { env });

    loadLiveSnapshots(makeStdinPayload({ cwd: "/repo" }), { env });

    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.previous).toEqual(cached);
  });

  it("omits `previous` when no cache exists for the cwd", () => {
    loadLiveSnapshots(makeStdinPayload({ cwd: "/repo" }), { env });
    const callArg = mockLoadGitSnapshot.mock.calls[0]?.[0];
    expect(callArg?.previous).toBeUndefined();
  });
});
