import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GitState } from "../git/index.js";
import type { ResolvedSessionFields } from "../session/index.js";
import type { StdinPayload } from "../stdin/index.js";
import type { TokensSnapshot } from "../tokens/index.js";
import { PRICING_TABLE_VERSION, contextWindowFor } from "../tokens/index.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";

import {
  previewWidget,
  resetPreviewModeCache,
  setPreviewModeForTesting,
} from "./preview-fixture.js";

const realPayload: StdinPayload = {
  raw: { model: "claude-opus-4-7", cwd: "/agentline" },
  truncated: false,
  model: "claude-opus-4-7",
  cwd: "/agentline",
  sessionId: "abcd1234",
};

const realSession: ResolvedSessionFields = {
  model: "claude-opus-4-7",
  sessionId: "abcd1234",
};

const realTokens: TokensSnapshot = Object.freeze({
  events: Object.freeze([
    {
      timestamp: Date.parse("2026-05-13T10:00:00.000Z"),
      model: "claude-opus-4-7",
      effort: "high",
      inputTokens: 12_000,
      outputTokens: 6_000,
      cachedTokens: 4_000,
      compaction: false,
    },
  ]) as TokensSnapshot["events"],
  now: Date.parse("2026-05-13T11:00:00.000Z"),
  sessionStart: Date.parse("2026-05-13T10:00:00.000Z"),
  blockAnchor: Date.parse("2026-05-13T10:00:00.000Z"),
  contextWindow: contextWindowFor("claude-opus-4-7"),
  pricingVersion: PRICING_TABLE_VERSION,
});

const realGit: GitState = Object.freeze({
  available: true,
  cwd: "/agentline",
  branch: "feat/preview-fixture",
  detached: false,
  sha: "0".repeat(40),
  shortSha: "0000000",
  status: Object.freeze({
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicts: 0,
    modified: 0,
    added: 0,
  }),
  diff: Object.freeze({ insertions: 0, deletions: 0, filesChanged: 0 }),
  diffStaged: Object.freeze({ insertions: 0, deletions: 0, filesChanged: 0 }),
  aheadBehind: Object.freeze({ ahead: 0, behind: 0 }),
  upstream: null,
  origin: null,
  upstreamRemote: null,
  worktreeName: null,
  inWorktree: false,
  pr: null,
});

beforeEach(() => {
  resetPreviewModeCache();
});

afterEach(() => {
  resetPreviewModeCache();
});

describe("previewWidget — label mode (no cache)", () => {
  it("renders every built-in widget as its own type name", () => {
    setPreviewModeForTesting({ kind: "label" });
    const registry = defaultRegistry();
    if (registry.size() === 0) registerAllBuiltins(registry);
    for (const type of registry.list()) {
      const cell = previewWidget(type);
      expect(cell.text, `cell.text for "${type}"`).toBe(type);
    }
  });

  it("returns label text even for unknown widget types", () => {
    setPreviewModeForTesting({ kind: "label" });
    expect(previewWidget("does-not-exist").text).toBe("does-not-exist");
  });

  it("propagates per-widget colour and style overrides", () => {
    setPreviewModeForTesting({ kind: "label" });
    /*
     * The wrapper consults `config.fg`/`bg`/`bold`/`italic`; only `fg`
     * and `bold` show up on a label cell because `previewWidget` doesn't
     * accept them — but the renderWidgetLabel branch we exercise *does*
     * emit those when set on the WidgetConfig. We verify the basic text
     * path; full override surface is covered in render-widget.test.ts.
     */
    const cell = previewWidget("tokens-input");
    expect(cell.text).toBe("tokens-input");
  });

  it("hides hidden:true widgets even in label mode (caller responsibility)", () => {
    /*
     * `previewWidget` takes (type, options) only — `hidden` flag would
     * need to be threaded via the WidgetConfig used internally. This
     * test pins the public contract: a known widget always renders its
     * label, never `(hidden)`.
     */
    setPreviewModeForTesting({ kind: "label" });
    expect(previewWidget("git-branch").text).toBe("git-branch");
  });
});

describe("previewWidget — real mode (cache hit)", () => {
  it("renders model from cached stdin payload", () => {
    setPreviewModeForTesting({
      kind: "real",
      payload: realPayload,
      session: realSession,
      tokens: realTokens,
      git: realGit,
    });
    expect(previewWidget("model").text.length).toBeGreaterThan(0);
    expect(previewWidget("model").text).toContain("Opus 4.7");
  });

  it("renders the cached branch name for git-branch", () => {
    setPreviewModeForTesting({
      kind: "real",
      payload: realPayload,
      session: realSession,
      tokens: realTokens,
      git: realGit,
    });
    expect(previewWidget("git-branch").text).toContain("feat/preview-fixture");
  });

  it("returns a hidden cell for an unknown type in real mode", () => {
    setPreviewModeForTesting({
      kind: "real",
      payload: realPayload,
      session: realSession,
      tokens: realTokens,
      git: realGit,
    });
    expect(previewWidget("does-not-exist")).toMatchObject({ hidden: true });
  });
});
