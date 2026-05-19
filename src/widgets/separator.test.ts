/**
 * The intra-widget value separator is config-driven (§7.1). These tests
 * pin the contract end-to-end: the helper reads `global.valueSeparator`,
 * the default is the U+00B7 MIDDLE DOT, and a custom value flows through
 * a `parts.join`-style widget, a template-literal widget and a postfix
 * widget alike.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../data/config/index.js";
import type { AgentlineConfig } from "../data/config/index.js";
import type { StdinPayload } from "../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../data/tokens/index.js";

import { frozenClock } from "./clock.js";
import type { WidgetContext } from "./context.js";
import { joinValues, valueSeparator } from "./separator.js";

import { tokensWidget } from "./tokens/fields.js";
import { contextLengthWidget } from "./context/context-length.js";
import { sessionWeeklyUsageWidget } from "./rate-limits/usage.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

const ev = (overrides: Partial<TranscriptEvent>): TranscriptEvent => ({
  timestamp: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  compaction: false,
  ...overrides,
});

function makeSnapshot(events: TranscriptEvent[]): TokensSnapshot {
  const now = 1_000_000;
  return Object.freeze({
    events: Object.freeze(events) as readonly TranscriptEvent[],
    now,
    sessionStart: events[0]?.timestamp ?? now,
    blockAnchor: events[0]?.timestamp ?? now,
    contextWindow: 200_000,
  });
}

/** Build a context whose `global.valueSeparator` is overridden. */
function ctxWithSeparator(
  separator: string,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  const config: AgentlineConfig = {
    ...DEFAULT_CONFIG,
    global: { ...DEFAULT_CONFIG.global, valueSeparator: separator },
  };
  return {
    stdin: baseStdin,
    config,
    theme: null,
    clock: frozenClock("2026-05-01T00:00:00Z"),
    env: {},
    ...overrides,
  };
}

describe("separator helper", () => {
  it("reads global.valueSeparator", () => {
    expect(valueSeparator(ctxWithSeparator("/"))).toBe("/");
    expect(valueSeparator(ctxWithSeparator("·"))).toBe("·");
  });

  it("defaults to the U+00B7 MIDDLE DOT", () => {
    expect(DEFAULT_CONFIG.global.valueSeparator).toBe("·");
  });

  it("joinValues single-spaces the configured separator on each side", () => {
    expect(joinValues(ctxWithSeparator("/"), ["a", "b"])).toBe("a / b");
    expect(joinValues(ctxWithSeparator("·"), ["a", "b", "c"])).toBe("a · b · c");
  });
});

describe("widgets honour the configured separator", () => {
  it("template-literal widget (tokens) uses a custom separator", () => {
    const snapshot = makeSnapshot([ev({ timestamp: 0, inputTokens: 100, outputTokens: 200 })]);
    const custom = tokensWidget.render(ctxWithSeparator("/", { tokens: snapshot }), {
      options: {},
      rawValue: false,
    });
    const dflt = tokensWidget.render(ctxWithSeparator("·", { tokens: snapshot }), {
      options: {},
      rawValue: false,
    });
    expect(custom.text).toBe("↓100 / ↑200");
    expect(dflt.text).toBe("↓100 · ↑200");
  });

  it("postfix widget (context-length) uses a custom separator", () => {
    const snapshot = makeSnapshot([ev({ timestamp: 0, inputTokens: 150_000 })]);
    const custom = contextLengthWidget.render(ctxWithSeparator("/", { tokens: snapshot }), {
      options: {},
      rawValue: false,
    });
    const dflt = contextLengthWidget.render(ctxWithSeparator("·", { tokens: snapshot }), {
      options: {},
      rawValue: false,
    });
    expect(custom.text).toBe("150k / 200k");
    expect(dflt.text).toBe("150k · 200k");
  });

  it("parts.join widget (session-weekly-usage) uses a custom separator", () => {
    const stdin: StdinPayload = {
      raw: {},
      truncated: false,
      rateLimits: { fiveHour: { usedPercentage: 52 }, sevenDay: { usedPercentage: 33 } },
    };
    const custom = sessionWeeklyUsageWidget.render(ctxWithSeparator("/", { stdin }), {
      options: {},
      rawValue: false,
    });
    const dflt = sessionWeeklyUsageWidget.render(ctxWithSeparator("·", { stdin }), {
      options: {},
      rawValue: false,
    });
    expect(custom.text).toBe("52% / weekly 33%");
    expect(dflt.text).toBe("52% · weekly 33%");
  });
});
