import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { sessionUsageWidget } from "./usage.js";

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
  const now = overrides.now ?? Date.parse("2026-05-01T03:00:00Z");
  const blockAnchor =
    overrides.blockAnchor !== undefined
      ? overrides.blockAnchor
      : (events[0]?.timestamp ?? now);
  const sessionStart =
    overrides.sessionStart !== undefined
      ? overrides.sessionStart
      : (events[0]?.timestamp ?? now);
  return Object.freeze({
    events: Object.freeze(events) as readonly TranscriptEvent[],
    now,
    sessionStart,
    blockAnchor,
    contextWindow: 200_000,
    pricingVersion: "test",
    ...overrides,
  });
}

function makeCtx(
  snapshot: TokensSnapshot | undefined,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  const now = snapshot?.now ?? Date.parse("2026-05-01T03:00:00Z");
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock(new Date(now)),
    env: {},
    tokens: snapshot,
    ...overrides,
  };
}

describe("session-usage widget", () => {
  it("hides when no snapshot is supplied", () => {
    const cell = sessionUsageWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders raw count when no limit is set", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 50_000, outputTokens: 5_000 })],
      { now: NOW },
    );
    const cell = sessionUsageWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("55k");
  });

  it("renders percentage when limit is set", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 60_000 })],
      { now: NOW },
    );
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.text).toBe("60%");
  });

  it("colour grades via tokens-high at 90%", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 90_000 })],
      { now: NOW },
    );
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-high"]);
  });

  it("colour grades via tokens-low below 60%", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 30_000 })],
      { now: NOW },
    );
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000 },
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE["tokens-low"]);
  });

  it("renders a 12-cell bar for display=bar", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 50_000 })],
      { now: NOW },
    );
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000, display: "bar" },
      rawValue: false,
    });
    expect(cell.text.length).toBe(12);
    expect(cell.text.startsWith("█")).toBe(true);
  });

  it("renders a 6-cell bar for display=short-bar", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 50_000 })],
      { now: NOW },
    );
    const cell = sessionUsageWidget.render(makeCtx(snap), {
      options: { limit: 100_000, display: "short-bar" },
      rawValue: false,
    });
    expect(cell.text.length).toBe(6);
  });

  it("suppresses label when rawValue: true", () => {
    const NOW = Date.parse("2026-05-01T03:00:00Z");
    const snap = makeSnapshot(
      [ev({ timestamp: NOW - 30 * 60 * 1000, inputTokens: 1_000 })],
      { now: NOW },
    );
    const withLabel = sessionUsageWidget.render(makeCtx(snap), {
      options: { label: "usage:", limit: 10_000 },
      rawValue: false,
    });
    const noLabel = sessionUsageWidget.render(makeCtx(snap), {
      options: { label: "usage:", limit: 10_000 },
      rawValue: true,
    });
    expect(withLabel.text).toMatch(/^usage:/);
    expect(noLabel.text).not.toMatch(/^usage:/);
  });
});
