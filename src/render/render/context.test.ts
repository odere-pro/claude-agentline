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

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/defaults/defaults.js";
import type { AgentlineConfig, WidgetConfig } from "../../data/config/types.js";
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
