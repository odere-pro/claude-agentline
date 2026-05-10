import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { inputSpeedWidget, outputSpeedWidget, totalSpeedWidget } from "./speed.js";

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

describe("input-speed widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = inputSpeedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders zero when no events in window", () => {
    const ctx = makeCtx(makeSnapshot([], { now: 1_000_000 }));
    const cell = inputSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });

  it("computes input tokens per second over default 60 s window", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, inputTokens: 600 })], { now }),
    );
    const cell = inputSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("10/s");
  });

  it("respects custom windowSec option", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 5_000, inputTokens: 50 })], { now }),
    );
    const cell = inputSpeedWidget.render(ctx, { options: { windowSec: 10 }, rawValue: false });
    expect(cell.text).toBe("5/s");
  });

  it("suppresses label when rawValue: true", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, inputTokens: 600 })], { now }),
    );
    const withLabel = inputSpeedWidget.render(ctx, { options: { label: "in:" }, rawValue: false });
    const noLabel = inputSpeedWidget.render(ctx, { options: { label: "in:" }, rawValue: true });
    expect(withLabel.text).toBe("in:10/s");
    expect(noLabel.text).toBe("10/s");
  });
});

describe("output-speed widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = outputSpeedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("computes output tokens per second", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, outputTokens: 300 })], { now }),
    );
    const cell = outputSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("5/s");
  });

  it("respects custom windowSec", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 5_000, outputTokens: 50 })], { now }),
    );
    const cell = outputSpeedWidget.render(ctx, { options: { windowSec: 10 }, rawValue: false });
    expect(cell.text).toBe("5/s");
  });

  it("suppresses label when rawValue: true", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, outputTokens: 300 })], { now }),
    );
    const noLabel = outputSpeedWidget.render(ctx, { options: { label: "out:" }, rawValue: true });
    expect(noLabel.text).toBe("5/s");
  });
});

describe("total-speed widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = totalSpeedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("sums input + output for total", () => {
    const now = 1_000_000;
    const ctx = makeCtx(
      makeSnapshot(
        [ev({ timestamp: now - 30_000, inputTokens: 300, outputTokens: 300 })],
        { now },
      ),
    );
    const cell = totalSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("10/s");
  });

  it("ignores cached tokens for speed calculation", () => {
    const now = 1_000_000;
    // Only cached tokens — total should reflect input+output (both zero)
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: now - 30_000, cachedTokens: 600 })], { now }),
    );
    const cell = totalSpeedWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });
});
