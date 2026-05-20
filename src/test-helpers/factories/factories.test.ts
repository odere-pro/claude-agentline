import { describe, expect, it } from "vitest";

import {
  makeCell,
  makeGitSnapshot,
  makeStdinPayload,
  makeTokensSnapshot,
  makeTranscriptEvent,
  makeWidgetContext,
} from "./factories.js";
import { CANONICAL_TEST_INSTANT, frozenClock } from "../clock/clock.js";

describe("makeStdinPayload", () => {
  it("returns a frozen { raw: {}, truncated: false } payload by default", () => {
    const p = makeStdinPayload();
    expect(p).toEqual({ raw: {}, truncated: false });
    expect(Object.isFrozen(p)).toBe(true);
  });

  it("right-wins on overrides", () => {
    const p = makeStdinPayload({ model: "claude-opus", truncated: true });
    expect(p.model).toBe("claude-opus");
    expect(p.truncated).toBe(true);
  });
});

describe("makeGitSnapshot", () => {
  it("defaults to a clean snapshot pinned to main", () => {
    const s = makeGitSnapshot();
    expect(s.available).toBe(true);
    if (!s.available) throw new Error("unreachable");
    expect(s.branch).toBe("main");
    expect(s.detached).toBe(false);
    expect(s.pr).toBeNull();
    expect(s.status).toEqual({
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicts: 0,
      modified: 0,
      added: 0,
    });
    expect(Object.isFrozen(s)).toBe(true);
  });

  it("right-wins on overrides for branch + pr", () => {
    const s = makeGitSnapshot({
      branch: "feat/x",
      pr: { number: 42, url: "https://example.com/pr/42", title: "do thing" },
    });
    if (!s.available) throw new Error("unreachable");
    expect(s.branch).toBe("feat/x");
    expect(s.pr).toEqual({ number: 42, url: "https://example.com/pr/42", title: "do thing" });
  });
});

describe("makeTranscriptEvent", () => {
  it("zero-fills every token field by default", () => {
    expect(makeTranscriptEvent()).toEqual({
      timestamp: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      compaction: false,
    });
  });

  it("right-wins on overrides", () => {
    const e = makeTranscriptEvent({ timestamp: 5, inputTokens: 100 });
    expect(e.timestamp).toBe(5);
    expect(e.inputTokens).toBe(100);
    expect(e.outputTokens).toBe(0);
  });
});

describe("makeTokensSnapshot", () => {
  it("returns a frozen 200k-window snapshot with no events", () => {
    const s = makeTokensSnapshot();
    expect(s.events).toEqual([]);
    expect(s.contextWindow).toBe(200_000);
    expect(s.now).toBe(1_000_000);
    expect(s.sessionStart).toBe(1_000_000);
    expect(s.blockAnchor).toBe(1_000_000);
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.events)).toBe(true);
  });

  it("derives anchors from the first event's timestamp", () => {
    const events = [makeTranscriptEvent({ timestamp: 12_345 })];
    const s = makeTokensSnapshot(events);
    expect(s.now).toBe(12_345);
    expect(s.sessionStart).toBe(12_345);
    expect(s.blockAnchor).toBe(12_345);
  });

  it("override now/sessionStart/blockAnchor wins over event-derived anchors", () => {
    const events = [makeTranscriptEvent({ timestamp: 12_345 })];
    const s = makeTokensSnapshot(events, { now: 99, sessionStart: 1, blockAnchor: 2 });
    expect(s.now).toBe(99);
    expect(s.sessionStart).toBe(1);
    expect(s.blockAnchor).toBe(2);
  });
});

describe("makeWidgetContext", () => {
  it("returns an empty default context pinned to the canonical instant", () => {
    const ctx = makeWidgetContext();
    expect(ctx.stdin).toEqual({ raw: {}, truncated: false });
    expect(ctx.theme).toBeNull();
    expect(ctx.env).toEqual({});
    expect(ctx.clock.now().toISOString()).toBe(
      new Date(CANONICAL_TEST_INSTANT).toISOString(),
    );
  });

  it("accepts a custom clock override", () => {
    const ctx = makeWidgetContext({ clock: frozenClock("2030-01-02T03:04:05Z") });
    expect(ctx.clock.now().toISOString()).toBe("2030-01-02T03:04:05.000Z");
  });

  it("accepts git/tokens overrides directly", () => {
    const ctx = makeWidgetContext({
      git: makeGitSnapshot({ branch: "feat/x" }),
      tokens: makeTokensSnapshot(),
    });
    expect(ctx.git?.available).toBe(true);
    if (!ctx.git?.available) throw new Error("unreachable");
    expect(ctx.git.branch).toBe("feat/x");
    expect(ctx.tokens?.contextWindow).toBe(200_000);
  });
});

describe("makeCell", () => {
  it("defaults to an empty visible cell and is frozen", () => {
    const c = makeCell();
    expect(c.text).toBe("");
    expect(c.hidden).toBeUndefined();
    expect(Object.isFrozen(c)).toBe(true);
  });

  it("right-wins on overrides", () => {
    const c = makeCell({ text: "ok", hidden: true });
    expect(c.text).toBe("ok");
    expect(c.hidden).toBe(true);
  });
});
