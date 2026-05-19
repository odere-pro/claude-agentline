import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GitState } from "../../data/git/index.js";
import type { ResolvedSessionFields } from "../../data/session/index.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import type { TokensSnapshot } from "../../data/tokens/index.js";
import { contextWindowFor } from "../../data/tokens/index.js";
import { DEFAULT_CONFIG } from "../../data/config/index.js";
import type { AgentlineConfig } from "../../data/config/types.js";
import { buildWidgetContext } from "../../render/render/context.js";
import { realClock } from "../../widgets/clock.js";
import { defaultRegistry, registerAllBuiltins } from "../../widgets/index.js";
import { renderWidget, widgetIdentityFor } from "../../widgets/render-widget.js";

import {
  previewWidget,
  resetPreviewModeCache,
  setPreviewModeForTesting,
  type PreviewMode,
} from "./preview-fixture.js";
import { buildMockPreview } from "./preview-mock.js";

/** Expected label-mode text: the family glyph prefix (unless the type is unknown). */
function expectedLabel(type: string): string {
  const id = widgetIdentityFor(type, { env: {}, config: DEFAULT_CONFIG });
  if (!id) return type;
  return `${id.glyph} ${type}`;
}

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

describe("previewWidget — mock mode (no cache, no transcript)", () => {
  const mock: PreviewMode = {
    source: "mock",
    ...buildMockPreview(Date.parse("2026-05-13T12:00:00.000Z")),
  };

  it("renders representative values for core widget families", () => {
    setPreviewModeForTesting(mock);
    expect(previewWidget("model").text).toContain("Opus 4.7");
    expect(previewWidget("git-branch").text).toContain("main");
    expect(previewWidget("account-email").text).toContain("you@example.com");
  });

  it("never renders a bare type-name placeholder for a known widget", () => {
    setPreviewModeForTesting(mock);
    const registry = defaultRegistry();
    if (registry.size() === 0) registerAllBuiltins(registry);
    for (const type of registry.list()) {
      const cell = previewWidget(type);
      // Either real text, or the dim identity chip — but not just `type`.
      if (cell.hidden) {
        expect(cell.text, `hidden chip for "${type}"`).toBe(expectedLabel(type));
      } else {
        expect(cell.text.length, `text for "${type}"`).toBeGreaterThan(0);
      }
    }
  });

  it("returns a hidden cell for an unknown widget type", () => {
    setPreviewModeForTesting(mock);
    expect(previewWidget("does-not-exist")).toMatchObject({ hidden: true });
  });
});

describe("previewWidget — self-hide fallback (real context, no data for widget)", () => {
  const bare: PreviewMode = {
    source: "cache",
    payload: { raw: {}, truncated: false },
    session: {},
    tokens: realTokens,
    git: { available: false },
  };

  it("degrades a data-less widget to a dim family-glyph + type-name chip", () => {
    setPreviewModeForTesting(bare);
    const cell = previewWidget("git-branch");
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe(expectedLabel("git-branch"));
  });
});

describe("previewWidget — real mode (cache hit)", () => {
  it("renders model from cached stdin payload", () => {
    setPreviewModeForTesting({
      source: "cache",
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
      source: "cache",
      payload: realPayload,
      session: realSession,
      tokens: realTokens,
      git: realGit,
    });
    expect(previewWidget("git-branch").text).toContain("feat/preview-fixture");
  });

  it("returns a hidden cell for an unknown type in real mode", () => {
    setPreviewModeForTesting({
      source: "cache",
      payload: realPayload,
      session: realSession,
      tokens: realTokens,
      git: realGit,
    });
    expect(previewWidget("does-not-exist")).toMatchObject({ hidden: true });
  });
});

describe("previewWidget — renders through the caller's resolved config", () => {
  /*
   * The root invariant: a preview is the live render given the same
   * `{ config, theme, env }`. `tokens` is a non-signal widget, so
   * its colour and glyph come straight from family identity — the most
   * direct probe that `config.families` reaches the preview path.
   * `glyph === glyphAscii` keeps the assertion env-independent.
   */
  const customConfig: AgentlineConfig = {
    ...DEFAULT_CONFIG,
    families: {
      ...DEFAULT_CONFIG.families,
      tokens: { colour: "#abcdef", glyph: "T!", glyphAscii: "T!" },
    },
  };

  function pin(): void {
    setPreviewModeForTesting({
      source: "cache",
      payload: realPayload,
      session: realSession,
      tokens: realTokens,
      git: realGit,
    });
  }

  it("honours a config.families override (default config keeps the built-in accent)", () => {
    pin();
    const fallback = previewWidget("tokens");
    expect(fallback.fg).toBe(
      widgetIdentityFor("tokens", { env: {}, config: DEFAULT_CONFIG })?.colour,
    );

    const cell = previewWidget("tokens", undefined, { config: customConfig });
    expect(cell.fg).toBe("#abcdef");
    expect(cell.text.startsWith("T! ")).toBe(true);
  });

  it("matches renderWidget byte-for-byte given the same basis", () => {
    pin();
    const registry = defaultRegistry();
    if (registry.size() === 0) registerAllBuiltins(registry);
    const ctx = buildWidgetContext({
      payload: realPayload,
      config: customConfig,
      theme: null,
      clock: realClock,
      env: {},
      tokens: realTokens,
      git: realGit,
      session: realSession,
    });
    const live = renderWidget(registry, { type: "tokens" }, ctx);
    const preview = previewWidget("tokens", undefined, { config: customConfig });
    expect(preview.fg).toBe(live.fg);
    expect(preview.text).toBe(live.text);
  });
});
