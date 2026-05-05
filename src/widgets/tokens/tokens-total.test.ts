import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { tokensTotalWidget } from "./tokens-total.js";

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

describe("tokens-total widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = tokensTotalWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders 0 with no events", () => {
    const ctx = makeCtx(makeSnapshot([]));
    const cell = tokensTotalWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });

  it("sums input + output + cached tokens", () => {
    const ctx = makeCtx(
      makeSnapshot([
        ev({ timestamp: 0, inputTokens: 100, outputTokens: 200, cachedTokens: 300 }),
      ]),
    );
    const cell = tokensTotalWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("600");
  });

  it("sums across multiple events", () => {
    const ctx = makeCtx(
      makeSnapshot([
        ev({ timestamp: 0, inputTokens: 500 }),
        ev({ timestamp: 100, outputTokens: 500 }),
        ev({ timestamp: 200, cachedTokens: 500 }),
      ]),
    );
    const cell = tokensTotalWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("1.5k");
  });

  it("respects options.reset = block axis", () => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = 10_000_000;
    const oldEv = ev({ timestamp: now - SIX_HOURS, inputTokens: 999 });
    const recentEv = ev({ timestamp: now - 60_000, inputTokens: 10 });
    const ctx = makeCtx(
      makeSnapshot([oldEv, recentEv], { now, blockAnchor: now - SIX_HOURS }),
    );
    const cell = tokensTotalWidget.render(ctx, { options: { reset: "block" }, rawValue: false });
    expect(cell.text).toBe("10");
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 300 })]));
    const withLabel = tokensTotalWidget.render(
      ctx, { options: { label: "total:" }, rawValue: false },
    );
    const noLabel = tokensTotalWidget.render(
      ctx, { options: { label: "total:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("total:300");
    expect(noLabel.text).toBe("300");
  });
});
