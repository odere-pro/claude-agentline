import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import {
  compactionCounterWidget,
  effortUsageWidget,
  modelUsageWidget,
} from "./aggregates.js";

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

describe("model-usage widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = modelUsageWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when no model id is in stdin", () => {
    const snap = makeSnapshot([ev({ model: "claude-opus-4-7", inputTokens: 1_000 })]);
    const cell = modelUsageWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("aggregates only events matching the active model", () => {
    const snap = makeSnapshot([
      ev({ model: "claude-opus-4-7", inputTokens: 5_000 }),
      ev({ model: "claude-haiku-4-5", inputTokens: 99_999 }),
      ev({ model: "claude-opus-4-7", outputTokens: 2_000 }),
    ]);
    const ctx = makeCtx(snap, { model: "claude-opus-4-7" });
    const cell = modelUsageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("7k");
  });

  it("renders 0 when model has no matching events", () => {
    const snap = makeSnapshot([ev({ model: "claude-haiku-4-5", inputTokens: 1_000 })]);
    const ctx = makeCtx(snap, { model: "claude-opus-4-7" });
    const cell = modelUsageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot([ev({ model: "claude-opus-4-7", inputTokens: 1_000 })]);
    const ctx = makeCtx(snap, { model: "claude-opus-4-7" });
    const withLabel = modelUsageWidget.render(ctx, {
      options: { label: "model:" },
      rawValue: false,
    });
    const noLabel = modelUsageWidget.render(ctx, {
      options: { label: "model:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("model:1k");
    expect(noLabel.text).toBe("1k");
  });
});

describe("effort-usage widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = effortUsageWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("hides when no thinkingEffort is in stdin", () => {
    const snap = makeSnapshot([ev({ effort: "high", inputTokens: 1_000 })]);
    const cell = effortUsageWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("aggregates events that match the active effort", () => {
    const snap = makeSnapshot([
      ev({ effort: "high", inputTokens: 5_000 }),
      ev({ effort: "low", inputTokens: 99_999 }),
      ev({ effort: "high", cachedTokens: 1_000 }),
    ]);
    const ctx = makeCtx(snap, { thinkingEffort: "high" });
    const cell = effortUsageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("6k");
  });

  it("renders 0 when effort has no matching events", () => {
    const snap = makeSnapshot([ev({ effort: "low", inputTokens: 1_000 })]);
    const ctx = makeCtx(snap, { thinkingEffort: "high" });
    const cell = effortUsageWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toBe("0");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot([ev({ effort: "medium", outputTokens: 500 })]);
    const ctx = makeCtx(snap, { thinkingEffort: "medium" });
    const withLabel = effortUsageWidget.render(ctx, {
      options: { label: "effort:" },
      rawValue: false,
    });
    const noLabel = effortUsageWidget.render(ctx, {
      options: { label: "effort:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("effort:500");
    expect(noLabel.text).toBe("500");
  });
});

describe("compaction-counter widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = compactionCounterWidget.render(makeCtx(undefined), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("hides when zero compactions by default", () => {
    const snap = makeSnapshot([ev({ inputTokens: 100 })]);
    const cell = compactionCounterWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("counts compaction events", () => {
    const snap = makeSnapshot([
      ev({ compaction: true }),
      ev({ inputTokens: 10 }),
      ev({ compaction: true }),
      ev({ compaction: true }),
    ]);
    const cell = compactionCounterWidget.render(makeCtx(snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("3");
  });

  it("can render zero when hideZero is disabled", () => {
    const snap = makeSnapshot([ev({ inputTokens: 100 })]);
    const cell = compactionCounterWidget.render(makeCtx(snap), {
      options: { hideZero: false },
      rawValue: false,
    });
    expect(cell.text).toBe("0");
  });

  it("renders custom label with count", () => {
    const snap = makeSnapshot([ev({ compaction: true }), ev({ compaction: true })]);
    const cell = compactionCounterWidget.render(makeCtx(snap), {
      options: { label: "compact:" },
      rawValue: false,
    });
    expect(cell.text).toBe("compact:2");
  });

  it("suppresses label when rawValue: true", () => {
    const snap = makeSnapshot([ev({ compaction: true })]);
    const withLabel = compactionCounterWidget.render(makeCtx(snap), {
      options: { label: "c:" },
      rawValue: false,
    });
    const noLabel = compactionCounterWidget.render(makeCtx(snap), {
      options: { label: "c:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("c:1");
    expect(noLabel.text).toBe("1");
  });
});
