/**
 * Last-resort mock session for the editor preview.
 *
 * Used only when the preview can resolve no real data at all: there is no
 * `last-stdin.json` cache *and* no discoverable Claude Code transcript (see
 * `preview-discovery.ts`). That happens when agentline is being configured
 * before Claude Code has ever run the statusline and there is no Claude
 * Code data directory to read from.
 *
 * Every field is a hand-written literal — clean-room, no third-party
 * derivation, no filesystem or network I/O. Timings are computed relative
 * to the supplied `now` so reset / elapsed / speed widgets read as a live
 * session instead of a frozen instant.
 */

import type { GitState } from "../../data/git/index.js";
import type { ResolvedSessionFields } from "../../data/session/index.js";
import type { PlanSnapshot } from "../../data/session/plan/plan.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import { contextWindowFor, type TokensSnapshot } from "../../data/tokens/index.js";

/** The snapshots `previewWidget` threads into `buildWidgetContext`. */
export interface MockPreview {
  readonly payload: StdinPayload;
  readonly session: ResolvedSessionFields;
  readonly tokens: TokensSnapshot;
  readonly git: GitState;
  readonly plan: PlanSnapshot;
}

/** Fallback model id/label used by discovered mode when a transcript carries none. */
export const MOCK_MODEL = "claude-opus-4-8";
export const MOCK_MODEL_LABEL = "Opus 4.8";
const MOCK_CWD = "/agentline";
const MOCK_SESSION_ID = "preview0000mock";
const MINUTE = 60_000;

/**
 * Build a representative mock session whose time-relative fields are
 * anchored at `now` (defaults to the wall clock). Rich enough that every
 * widget family renders a meaningful value.
 */
export function buildMockPreview(now: number = Date.now()): MockPreview {
  const fiveHourReset = Math.floor(now / 1000) + 2 * 60 * 60;
  const sevenDayReset = Math.floor(now / 1000) + 5 * 24 * 60 * 60;
  const payload: StdinPayload = {
    raw: {},
    truncated: false,
    model: MOCK_MODEL,
    modelDisplayName: MOCK_MODEL_LABEL,
    version: "2.0.14",
    outputStyle: "default",
    sessionId: MOCK_SESSION_ID,
    sessionName: "preview",
    cwd: MOCK_CWD,
    thinkingEffort: "max",
    vimMode: "INSERT",
    rateLimits: {
      fiveHour: { usedPercentage: 21, resetsAt: fiveHourReset },
      sevenDay: { usedPercentage: 31, resetsAt: sevenDayReset },
    },
    // Host-provided PR data: exercises the git-pr-review (reviewState) widget in
    // the picker preview. number + url feed the git-pr widget too — the mock git
    // snapshot below mirrors these as its host-bridge PR.
    pr: {
      reviewState: "approved",
      number: 1,
      url: "https://github.com/owner/repo/pull/1",
    },
    // Host-provided repo identity: exercises git-origin-repo owner-name variant.
    workspaceRepo: { host: "github.com", owner: "owner", name: "repo" },
  };

  const session: ResolvedSessionFields = {
    model: MOCK_MODEL,
    version: "2.0.14",
    outputStyle: "default",
    sessionId: MOCK_SESSION_ID,
    accountEmail: "you@example.com",
    loginMethod: "oauth",
    orgSlug: "agentline",
    thinkingEffort: "max",
    vimMode: "INSERT",
  };

  const plan: PlanSnapshot = { name: "preview-plan", href: "file:///plans/preview-plan.md" };

  const tokens: TokensSnapshot = {
    events: [
      {
        timestamp: now - 30 * MINUTE,
        model: MOCK_MODEL,
        effort: "max",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        compaction: true,
      },
      {
        timestamp: now - MINUTE,
        model: MOCK_MODEL,
        effort: "max",
        inputTokens: 12_345,
        outputTokens: 6_789,
        cachedTokens: 4_321,
        compaction: false,
      },
    ],
    now,
    sessionStart: now - 120 * MINUTE,
    blockAnchor: now - 90 * MINUTE,
    contextWindow: contextWindowFor(MOCK_MODEL),
  };

  const git: GitState = {
    available: true,
    cwd: MOCK_CWD,
    branch: "main",
    detached: false,
    sha: "a1b2c3def4567890abcdef1234567890abcdef12",
    shortSha: "a1b2c3d",
    status: { staged: 2, unstaged: 1, untracked: 0, conflicts: 0, modified: 1, added: 1 },
    diff: { insertions: 12, deletions: 3, filesChanged: 2 },
    diffStaged: { insertions: 8, deletions: 1, filesChanged: 1 },
    aheadBehind: { ahead: 1, behind: 0 },
    upstream: "origin/main",
    origin: { owner: "agentline", repo: "agentline" },
    upstreamRemote: null,
    worktreeName: null,
    inWorktree: false,
    // Mirror the host `pr` block above as the host-bridge outcome, so a user
    // configuring a git-pr widget sees it render in the preview by default
    // (host-provided PRs need no allowNetwork opt-in).
    pr: { number: 1, url: "https://github.com/owner/repo/pull/1", title: "" },
    prSource: "host",
  };

  return { payload, session, tokens, git, plan };
}
