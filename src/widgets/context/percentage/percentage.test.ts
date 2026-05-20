import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../../data/tokens/index.js";

import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";

import { contextPercentageWidget } from "./percentage.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function stdinWithContext(contextWindow: NonNullable<StdinPayload["contextWindow"]>): StdinPayload {
  return { raw: {}, truncated: false, contextWindow };
}

const ev = (overrides: Partial<TranscriptEvent>): TranscriptEvent => ({
  timestamp: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  compaction: false,
  ...overrides,
});

function makeSnapshot(
  events: TranscriptEvent[],
  overrides: Partial<TokensSnapshot> = {},
): TokensSnapshot {
  const now = overrides.now ?? 1_000_000;
  return Object.freeze({
    events: Object.freeze(events) as readonly TranscriptEvent[],
    now,
    sessionStart: events[0]?.timestamp ?? now,
    blockAnchor: events[0]?.timestamp ?? now,
    contextWindow: overrides.contextWindow ?? 200_000,
    ...overrides,
  });
}

function makeCtx(
  snapshot: TokensSnapshot | undefined,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-05-01T00:00:00Z"),
    env: {},
    tokens: snapshot,
    ...overrides,
  };
}

describe("context-percentage widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = contextPercentageWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders 0% when no tokens used, plus the window postfix", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }));
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0% · 200k");
  });

  it("renders correct percentage", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("50% · 200k");
  });

  it("renders 100% at full capacity", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 200_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("100% · 200k");
  });

  it("emits no state-signal colour so the context family accent applies", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 180_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBeUndefined();
    expect(cell.signal).toBeUndefined();
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
    );
    const withLabel = contextPercentageWidget.render(ctx, {
      options: { label: "ctx:" },
      rawValue: false,
    });
    const noLabel = contextPercentageWidget.render(ctx, {
      options: { label: "ctx:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("ctx:50% · 200k");
    expect(noLabel.text).toBe("50% · 200k");
  });
});

describe("context-percentage — stdin priority branches", () => {
  it("prefers stdin.contextWindow.usedTokens over the local aggregate", () => {
    const ctx = makeCtx(
      // Aggregate would give 90% but stdin reports the current turn.
      makeSnapshot([ev({ timestamp: 0, inputTokens: 180_000 })], { contextWindow: 200_000 }),
      {
        stdin: stdinWithContext({ usedTokens: 50_000, windowSize: 200_000 }),
      },
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("25% · 200k");
  });

  it("falls back to ctx.tokens.contextWindow when stdin omits windowSize", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }), {
      stdin: stdinWithContext({ usedTokens: 50_000 }),
    });
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("25% · 200k");
  });

  it("synthesises usage from usedPercentage when usedTokens is missing", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }), {
      stdin: stdinWithContext({ usedPercentage: 37, windowSize: 200_000 }),
    });
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("37% · 200k");
  });

  it("falls through to the legacy aggregate when neither usedTokens nor usedPercentage is set", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
      // Empty contextWindow block — adapter would normally return undefined,
      // but a stdin payload could still arrive shaped this way via a raw pass-through.
      { stdin: { raw: {}, truncated: false } },
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("50% · 200k");
  });

  it("hides when both stdin and ctx.tokens lack any usage data", () => {
    const ctx = makeCtx(undefined, { stdin: { raw: {}, truncated: false } });
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("omits the window postfix when both window sources are absent (synthetic window)", () => {
    // No ctx.tokens snapshot, no windowSize on stdin: the synthetic
    // window keeps the divisor meaningful for the percentage, but it's
    // below MIN_WINDOW_FOR_POSTFIX so the size postfix is dropped.
    const ctx = makeCtx(undefined, {
      stdin: stdinWithContext({ usedPercentage: 50 }),
    });
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("50%");
  });
});
