import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { tokensOutputWidget } from "./tokens-output.js";

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

describe("tokens-output widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = tokensOutputWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders 0 with no output events", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })]));
    const cell = tokensOutputWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });

  it("sums output tokens across multiple events", () => {
    const ctx = makeCtx(
      makeSnapshot([
        ev({ timestamp: 0, outputTokens: 1500 }),
        ev({ timestamp: 100, outputTokens: 1000 }),
      ]),
    );
    const cell = tokensOutputWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("2.5k");
  });

  it("does not include input or cached tokens", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 999, cachedTokens: 999, outputTokens: 200 })]),
    );
    const cell = tokensOutputWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("200");
  });

  it("respects options.reset = block axis", () => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = 10_000_000;
    const oldEv = ev({ timestamp: now - SIX_HOURS, outputTokens: 999 });
    const recentEv = ev({ timestamp: now - 60_000, outputTokens: 42 });
    const ctx = makeCtx(
      makeSnapshot([oldEv, recentEv], { now, blockAnchor: now - SIX_HOURS }),
    );
    const cell = tokensOutputWidget.render(ctx, { options: { reset: "block" }, rawValue: false });
    expect(cell.text).toBe("42");
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, outputTokens: 250 })]));
    const withLabel = tokensOutputWidget.render(
      ctx, { options: { label: "out:" }, rawValue: false },
    );
    const noLabel = tokensOutputWidget.render(
      ctx, { options: { label: "out:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("out:250");
    expect(noLabel.text).toBe("250");
  });
});
