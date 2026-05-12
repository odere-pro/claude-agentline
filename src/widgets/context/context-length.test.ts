import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { contextLengthWidget } from "./context-length.js";

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
    contextWindow: 200_000,
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

describe("context-length widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = contextLengthWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders 0 with no events", () => {
    const ctx = makeCtx(makeSnapshot([]));
    const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });

  it("sums input + cached tokens (not output)", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 1500, outputTokens: 9999, cachedTokens: 500 })]),
    );
    const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("2k");
  });

  it("does not include output tokens in context length", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, outputTokens: 5000, inputTokens: 100 })]),
    );
    const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("100");
  });

  it("formats large context lengths with k suffix", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 150_000 })]),
    );
    const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("150k");
  });

  it("renders custom label when set", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 500 })]));
    const cell = contextLengthWidget.render(ctx, {
      options: { label: "ctx:" },
      rawValue: false,
    });
    expect(cell.text).toBe("ctx:500");
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 500 })]));
    const withLabel = contextLengthWidget.render(ctx, {
      options: { label: "ctx:" },
      rawValue: false,
    });
    const noLabel = contextLengthWidget.render(ctx, {
      options: { label: "ctx:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("ctx:500");
    expect(noLabel.text).toBe("500");
  });
});
