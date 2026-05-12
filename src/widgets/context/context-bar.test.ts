import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { contextBarWidget } from "./context-bar.js";

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

describe("context-bar widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = contextBarWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders a bar of the configured width (default 12)", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text.length).toBe(12);
  });

  it("renders the bar with the custom width option", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 8, filled: "#", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("##......");
  });

  it("renders a full bar at 100% usage", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 200_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 5, filled: "X", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("XXXXX");
  });

  it("renders an empty bar at 0% usage", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 5, filled: "X", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe(".....");
  });

  it("uses tokens-low colour below 60%", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-low"]);
  });

  it("uses tokens-mid colour between 60% and 80%", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 140_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-mid"]);
  });

  it("uses tokens-high colour above 80%", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 180_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-high"]);
  });

  it("suppresses label when rawValue: true", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const withLabel = contextBarWidget.render(ctx, {
      options: { label: "ctx:", width: 4, filled: "X", empty: "." },
      rawValue: false,
    });
    const noLabel = contextBarWidget.render(ctx, {
      options: { label: "ctx:", width: 4, filled: "X", empty: "." },
      rawValue: true,
    });
    expect(withLabel.text).toMatch(/^ctx:/);
    expect(noLabel.text).not.toMatch(/^ctx:/);
  });
});
