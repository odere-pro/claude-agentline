import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { blockResetAtWidget, weeklyResetAtWidget } from "./reset-at.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };
const HOUR_MS = 60 * 60 * 1000;

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
  return Object.freeze({
    events: Object.freeze(events) as readonly TranscriptEvent[],
    now,
    sessionStart: events[0]?.timestamp ?? now,
    blockAnchor: overrides.blockAnchor ?? (events[0]?.timestamp ?? now),
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

describe("block-reset-at widget", () => {
  it("renders the wall-clock of the next block reset with default label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { tz: "UTC" },
      rawValue: false,
    });
    // 5h block anchored at 13:00 UTC → next reset at 18:00 UTC.
    expect(cell.text).toBe("resets 18:00");
  });

  it("rawValue strips the default label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("18:00");
  });

  it("honours options.format", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { format: "h:mma", tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("6:00pm");
  });

  it("falls back to now + 5h when no snapshot is present", () => {
    const ctx = {
      stdin: baseStdin,
      config: DEFAULT_CONFIG,
      theme: null,
      clock: frozenClock("2026-05-01T13:00:00Z"),
      env: {},
    } as WidgetContext;
    const cell = blockResetAtWidget.render(ctx, {
      options: { tz: "UTC" },
      rawValue: true,
    });
    expect(cell.text).toBe("18:00");
  });

  it("respects a custom label", () => {
    const anchor = Date.parse("2026-05-01T13:00:00Z");
    const now = anchor + HOUR_MS;
    const snap = makeSnapshot([ev({ timestamp: anchor, inputTokens: 1 })], {
      now,
      blockAnchor: anchor,
    });
    const cell = blockResetAtWidget.render(makeCtx(snap), {
      options: { label: "next ", tz: "UTC" },
      rawValue: false,
    });
    expect(cell.text).toBe("next 18:00");
  });
});

describe("weekly-reset-at widget", () => {
  it("renders with 'week resets ' default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetAtWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("emits a HH:mm clock body after the label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetAtWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toMatch(/^week resets \d{2}:\d{2}$/);
  });

  it("works without a snapshot (clock-only)", () => {
    const ctx = {
      stdin: baseStdin,
      config: DEFAULT_CONFIG,
      theme: null,
      clock: frozenClock("2026-04-28T12:00:00Z"),
      env: {},
    } as WidgetContext;
    const cell = weeklyResetAtWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text.startsWith("week resets ")).toBe(true);
  });

  it("rawValue strips the default label", () => {
    const snap = makeSnapshot([], { now: Date.parse("2026-04-28T12:00:00Z") });
    const cell = weeklyResetAtWidget.render(makeCtx(snap), {
      options: {},
      rawValue: true,
    });
    expect(cell.text.startsWith("week resets ")).toBe(false);
    expect(cell.text).toMatch(/^\d{2}:\d{2}$/);
  });
});
