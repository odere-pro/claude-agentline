import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { costWidget } from "./cost.js";

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
  stdinOverrides: Partial<StdinPayload> = {},
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: { ...baseStdin, ...stdinOverrides },
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-05-01T00:00:00Z"),
    env: {},
    tokens: snapshot,
    ...overrides,
  };
}

describe("cost widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = costWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders $0.00 for zero tokens", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })]));
    const cell = costWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("$0.00");
  });

  it("prices haiku at a lower rate than opus", () => {
    const haiku = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 1_000_000, model: "claude-haiku-4-5" })]),
    );
    const opus = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 1_000_000, model: "claude-opus-4-7" })]),
    );
    const haikuCost = parseFloat(
      costWidget.render(haiku, { options: {}, rawValue: false }).text.replace("$", ""),
    );
    const opusCost = parseFloat(
      costWidget.render(opus, { options: {}, rawValue: false }).text.replace("$", ""),
    );
    expect(haikuCost).toBeLessThan(opusCost);
  });

  it("respects options.reset = block axis", () => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = 10_000_000;
    const oldEv = ev({ timestamp: now - SIX_HOURS, inputTokens: 1_000_000, model: "claude-haiku-4-5" });
    const recentEv = ev({ timestamp: now - 60_000, inputTokens: 0 });
    const ctx = makeCtx(
      makeSnapshot([oldEv, recentEv], { now, blockAnchor: now - SIX_HOURS }),
    );
    const sessionCell = costWidget.render(ctx, { options: { reset: "session" }, rawValue: false });
    const blockCell = costWidget.render(ctx, { options: { reset: "block" }, rawValue: false });
    // block axis only sees the recent event (zero tokens), session sees the old event too
    const sessionCost = parseFloat(sessionCell.text.replace("$", ""));
    const blockCost = parseFloat(blockCell.text.replace("$", ""));
    expect(sessionCost).toBeGreaterThan(blockCost);
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })]));
    const withLabel = costWidget.render(ctx, { options: { label: "cost:" }, rawValue: false });
    const noLabel = costWidget.render(ctx, { options: { label: "cost:" }, rawValue: true });
    expect(withLabel.text).toBe("cost:$0.00");
    expect(noLabel.text).toBe("$0.00");
  });

  it("renders custom label when set", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })]));
    const cell = costWidget.render(ctx, { options: { label: "USD:" }, rawValue: false });
    expect(cell.text.startsWith("USD:")).toBe(true);
  });
});
