import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/index.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../data/tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { tokenSpeedWidget } from "./speed.js";

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

describe("token-speed widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = tokenSpeedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders ↓0 · ↑0 when no events in window", () => {
    const ctx = makeCtx(makeSnapshot([], { now: 1_000_000 }));
    const cell = tokenSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("↓0 · ↑0");
  });

  it("computes input ↓ and output ↑ per second over the default 60 s window", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, inputTokens: 600, outputTokens: 300 })], { now }),
    );
    const cell = tokenSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("↓10/s · ↑5/s");
  });

  it("respects a custom windowSec option", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 5_000, inputTokens: 50, outputTokens: 50 })], { now }),
    );
    const cell = tokenSpeedWidget.render(ctx, { options: { windowSec: 10 }, rawValue: false });
    expect(cell.text).toBe("↓5/s · ↑5/s");
  });

  it("ignores cached tokens for the rate calculation", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, cachedTokens: 600 })], { now }),
    );
    const cell = tokenSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("↓0 · ↑0");
  });

  it("accepts custom inputGlyph / outputGlyph", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, inputTokens: 600, outputTokens: 600 })], { now }),
    );
    const cell = tokenSpeedWidget.render(ctx, {
      options: { inputGlyph: ">", outputGlyph: "<" },
      rawValue: false,
    });
    expect(cell.text).toBe(">10/s · <10/s");
  });

  it("supports a label and suppresses it when rawValue: true", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, inputTokens: 600, outputTokens: 600 })], { now }),
    );
    const withLabel = tokenSpeedWidget.render(ctx, { options: { label: "io:" }, rawValue: false });
    const noLabel = tokenSpeedWidget.render(ctx, { options: { label: "io:" }, rawValue: true });
    expect(withLabel.text).toBe("io:↓10/s · ↑10/s");
    expect(noLabel.text).toBe("↓10/s · ↑10/s");
  });
});
