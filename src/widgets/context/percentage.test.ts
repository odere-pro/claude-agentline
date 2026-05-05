import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import {
  contextPercentageUsableWidget,
  contextPercentageWidget,
} from "./percentage.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

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
    pricingVersion: "test",
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

  it("renders 0% when no tokens used", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }));
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0%");
  });

  it("renders correct percentage", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("50%");
  });

  it("renders 100% at full capacity", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 200_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("100%");
  });

  it("uses tokens-low colour below 60%", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-low"]);
  });

  it("uses tokens-mid colour between 60% and 80%", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 140_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-mid"]);
  });

  it("uses tokens-high colour above 80%", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 180_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-high"]);
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
    expect(withLabel.text).toBe("ctx:50%");
    expect(noLabel.text).toBe("50%");
  });
});

describe("context-percentage-usable widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = contextPercentageUsableWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("uses 80% of the window as the denominator", () => {
    // 80_000 tokens used / (200_000 * 0.8 usable) = 50%
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 80_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageUsableWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("50%");
  });

  it("renders higher percentages than context-percentage for the same usage", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
    );
    const percentCell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    const usableCell = contextPercentageUsableWidget.render(ctx, { options: {}, rawValue: false });
    const pct = parseInt(percentCell.text.replace("%", ""), 10);
    const usable = parseInt(usableCell.text.replace("%", ""), 10);
    expect(usable).toBeGreaterThan(pct);
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 80_000 })], { contextWindow: 200_000 }),
    );
    const withLabel = contextPercentageUsableWidget.render(ctx, {
      options: { label: "usable:" },
      rawValue: false,
    });
    const noLabel = contextPercentageUsableWidget.render(ctx, {
      options: { label: "usable:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("usable:50%");
    expect(noLabel.text).toBe("50%");
  });
});
