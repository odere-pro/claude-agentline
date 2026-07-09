/**
 * Consolidated test surface for every widget in `src/widgets/tokens/`.
 *
 * Multiple token/cost widgets share similar render contracts and test fixtures.
 * They were consolidated into a single file to reduce test boilerplate and
 * speed up the test run. Trade-off: a single failure masks which widget broke.
 * If frequent churn occurs, re-split into per-widget files.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../data/config/index.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../data/tokens/index.js";

import { frozenClock } from "../clock/clock.js";
import type { WidgetContext } from "../types.js";
import { WidgetRegistry } from "../registry/registry.js";

import { contextPercentageWidget } from "../context/percentage/percentage.js";
import { registerContextWidgets, CONTEXT_WIDGETS } from "../context/index.js";

import { tokensCachedWidget, tokensWidget } from "./fields.js";
import { formatCount, formatSpeed, tokenRole } from "./format/format.js";
import { resolveResetAxis } from "./options/options.js";
import { tokenSpeedWidget } from "./speed/speed.js";
import { registerTokenWidgets, TOKEN_WIDGETS } from "./index.js";

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

describe("formatters", () => {
  it("formatCount handles small / k / M ranges", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1500)).toBe("1.5k");
    expect(formatCount(50_000)).toBe("50k");
    expect(formatCount(1_500_000)).toBe("1.5M");
  });

  it("formatSpeed adapts to the rate magnitude", () => {
    expect(formatSpeed(0)).toBe("0");
    expect(formatSpeed(12.5)).toBe("12.5/s");
    expect(formatSpeed(500)).toBe("500/s");
    expect(formatSpeed(2500)).toBe("2.5k/s");
  });

  it("tokenRole crosses 60 / 80% boundaries", () => {
    expect(tokenRole(0)).toBe("tokens-low");
    expect(tokenRole(0.59)).toBe("tokens-low");
    expect(tokenRole(0.6)).toBe("tokens-mid");
    expect(tokenRole(0.79)).toBe("tokens-mid");
    expect(tokenRole(0.8)).toBe("tokens-high");
    expect(tokenRole(1.5)).toBe("tokens-high");
  });
});

describe("resolveResetAxis", () => {
  it("accepts every documented axis", () => {
    for (const axis of ["session", "block", "day", "week", "model", "effort"] as const) {
      expect(resolveResetAxis(axis)).toBe(axis);
    }
  });

  it("falls back to session for typos / wrong types", () => {
    expect(resolveResetAxis("daily")).toBe("session");
    expect(resolveResetAxis(42)).toBe("session");
    expect(resolveResetAxis(undefined)).toBe("session");
  });
});

describe("token widgets", () => {
  it("hide when ctx.tokens is undefined", () => {
    const ctx = makeCtx(undefined);
    expect(tokensWidget.render(ctx, { options: {}, rawValue: false }).hidden).toBe(true);
  });

  it("render 0 when the snapshot has no events", () => {
    const ctx = makeCtx(makeSnapshot([]));
    expect(tokensWidget.render(ctx, { options: {}, rawValue: false }).text).toBe("↓0 · ↑0");
  });

  it("tokens renders input ↓ and output ↑ summed across the session", () => {
    const ctx = makeCtx(
      makeSnapshot([
        ev({ timestamp: 100, inputTokens: 1000, outputTokens: 1500 }),
        ev({ timestamp: 200, inputTokens: 500, outputTokens: 1000 }),
      ]),
    );
    expect(tokensWidget.render(ctx, { options: {}, rawValue: false }).text).toBe("↓1.5k · ↑2.5k");
  });

  it("tokens excludes cached tokens from both segments", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100, outputTokens: 200, cachedTokens: 999 })]),
    );
    expect(tokensWidget.render(ctx, { options: {}, rawValue: false }).text).toBe("↓100 · ↑200");
  });

  it("tokens accepts custom inputGlyph / outputGlyph", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 100, outputTokens: 200 })]));
    expect(
      tokensWidget.render(ctx, {
        options: { inputGlyph: ">", outputGlyph: "<" },
        rawValue: false,
      }).text,
    ).toBe(">100 · <200");
  });

  // ── tokens-cached: point-in-time gauge, not an accumulator (issue #306) ──

  const cachedCtx = (contextWindow: StdinPayload["contextWindow"]): WidgetContext =>
    makeCtx(makeSnapshot([ev({ timestamp: 0, cachedTokens: 9_999_999 })]), {
      stdin: { ...baseStdin, ...(contextWindow ? { contextWindow } : {}) },
    });

  it("tokens-cached renders the cached portion of the current context window", () => {
    const ctx = cachedCtx({ cachedTokens: 323_428, windowSize: 1_000_000 });
    expect(tokensCachedWidget.render(ctx, { options: {}, rawValue: false }).text).toBe("323k");
  });

  it("tokens-cached ignores the transcript entirely — no cumulative sum", () => {
    // Regression: summing per-turn cache reads produced 163M against a true
    // cached context of 322k, because every turn re-reads the whole cache.
    const ctx = cachedCtx({ cachedTokens: 500 });
    expect(tokensCachedWidget.render(ctx, { options: {}, rawValue: false }).text).toBe("500");
  });

  it("tokens-cached never exceeds the context window", () => {
    const ctx = cachedCtx({ cachedTokens: 200_000, windowSize: 200_000 });
    const text = tokensCachedWidget.render(ctx, { options: {}, rawValue: false }).text;
    expect(text).toBe("200k");
  });

  it("tokens-cached hides when the host reports no cache figures", () => {
    const ctx = cachedCtx({ usedTokens: 10, windowSize: 200_000 });
    expect(tokensCachedWidget.render(ctx, { options: {}, rawValue: false }).hidden).toBe(true);
  });

  it("tokens-cached hides when the context_window block is absent", () => {
    const ctx = cachedCtx(undefined);
    expect(tokensCachedWidget.render(ctx, { options: {}, rawValue: false }).hidden).toBe(true);
  });

  it("tokens-cached honours the label option and rawValue", () => {
    const ctx = cachedCtx({ cachedTokens: 500 });
    expect(
      tokensCachedWidget.render(ctx, { options: { label: "cache " }, rawValue: false }).text,
    ).toBe("cache 500");
    expect(
      tokensCachedWidget.render(ctx, { options: { label: "cache " }, rawValue: true }).text,
    ).toBe("500");
  });

  it("respects options.reset axis", () => {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = 10_000_000;
    const old = ev({ timestamp: now - SIX_HOURS, inputTokens: 99 });
    const recent = ev({ timestamp: now - 60_000, inputTokens: 5 });
    const ctx = makeCtx(makeSnapshot([old, recent], { now, blockAnchor: now - SIX_HOURS }));
    const cell = tokensWidget.render(ctx, {
      options: { reset: "block" },
      rawValue: false,
    });
    expect(cell.text).toBe("↓5 · ↑0");
  });

  it("supports a custom label and rawValue suppression", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 100 })]));
    expect(tokensWidget.render(ctx, { options: { label: "io:" }, rawValue: false }).text).toBe(
      "io:↓100 · ↑0",
    );
    expect(tokensWidget.render(ctx, { options: { label: "io:" }, rawValue: true }).text).toBe(
      "↓100 · ↑0",
    );
  });
});

describe("speed widgets", () => {
  it("token-speed reports input ↓ and output ↑ per second over 60 s", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 1_000_000 - 30_000, inputTokens: 600, outputTokens: 600 })], {
        now: 1_000_000,
      }),
    );
    expect(tokenSpeedWidget.render(ctx, { options: {}, rawValue: false }).text).toBe(
      "↓10/s · ↑10/s",
    );
  });

  it("token-speed shows zero for the idle direction", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 1_000_000 - 30_000, inputTokens: 600 })], { now: 1_000_000 }),
    );
    expect(tokenSpeedWidget.render(ctx, { options: {}, rawValue: false }).text).toBe("↓10/s · ↑0");
  });

  it("token-speed honours custom windowSec", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 1_000_000 - 5000, outputTokens: 50 })], { now: 1_000_000 }),
    );
    expect(tokenSpeedWidget.render(ctx, { options: { windowSec: 10 }, rawValue: false }).text).toBe(
      "↓0 · ↑5/s",
    );
  });

  it("token-speed accepts custom inputGlyph / outputGlyph", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 1_000_000 - 30_000, inputTokens: 600, outputTokens: 600 })], {
        now: 1_000_000,
      }),
    );
    expect(
      tokenSpeedWidget.render(ctx, {
        options: { inputGlyph: ">", outputGlyph: "<" },
        rawValue: false,
      }).text,
    ).toBe(">10/s · <10/s");
  });
});

describe("context widgets", () => {
  it("context-percentage divides by the model's window", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextPercentageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("50% · 200k");
  });

  it("context-percentage emits no state-signal colour (context family accent applies)", () => {
    const events = (used: number) => [ev({ timestamp: 0, inputTokens: used })];
    for (const used of [50_000, 140_000, 180_000]) {
      const cell = contextPercentageWidget.render(makeCtx(makeSnapshot(events(used))), {
        options: {},
        rawValue: false,
      });
      expect(cell.fg).toBeUndefined();
      expect(cell.signal).toBeUndefined();
    }
  });
});

describe("registries", () => {
  it("registerTokenWidgets installs all eight widgets", () => {
    const r = new WidgetRegistry();
    registerTokenWidgets(r);
    expect(r.size()).toBe(8);
    expect(r.list()).toEqual([
      "api-duration",
      "cost-burn-rate",
      "cost-efficiency",
      "cost-usd",
      "cost-vs-limit",
      "token-speed",
      "tokens",
      "tokens-cached",
    ]);
  });

  it("registerContextWidgets installs the context widgets", () => {
    const r = new WidgetRegistry();
    registerContextWidgets(r);
    expect(r.size()).toBe(3);
    expect(r.list()).toEqual(["context-200k-flag", "context-cached", "context-percentage"]);
  });

  it("TOKEN_WIDGETS and CONTEXT_WIDGETS are frozen", () => {
    expect(Object.isFrozen(TOKEN_WIDGETS)).toBe(true);
    expect(Object.isFrozen(CONTEXT_WIDGETS)).toBe(true);
  });
});
