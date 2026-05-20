import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../../data/config/index.js";
import type { StdinPayload } from "../../../core/stdin/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../../data/tokens/index.js";

import { frozenClock } from "../../clock/clock.js";
import type { WidgetContext } from "../../types.js";

import { contextLengthWidget } from "./context-length.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function stdinWith(contextWindow: StdinPayload["contextWindow"]): StdinPayload {
  return { raw: {}, truncated: false, contextWindow };
}

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

describe("context-length widget", () => {
  it("hides when there is no context-window snapshot and no tokens", () => {
    const cell = contextLengthWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  describe("host context_window snapshot (current occupancy)", () => {
    it("renders usedTokens / windowSize from the host snapshot", () => {
      const ctx = makeCtx(undefined, {
        stdin: stdinWith({ usedTokens: 180_000, windowSize: 1_000_000 }),
      });
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("180k · 1M");
    });

    it("does not balloon past the window like the old cumulative sum", () => {
      // The transcript may carry millions of lifetime tokens, but the
      // current occupancy comes from the host snapshot, not the sum.
      const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 18_000_000 })]), {
        stdin: stdinWith({ usedTokens: 180_000, windowSize: 1_000_000 }),
      });
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("180k · 1M");
    });

    it("falls back to the snapshot window when windowSize is absent", () => {
      const ctx = makeCtx(makeSnapshot([], { contextWindow: 200_000 }), {
        stdin: stdinWith({ usedTokens: 45_200 }),
      });
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("45k · 200k");
    });

    it("synthesizes used from usedPercentage when only the ratio is reported", () => {
      const ctx = makeCtx(undefined, {
        stdin: stdinWith({ usedPercentage: 18, windowSize: 1_000_000 }),
      });
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("180k · 1M");
    });

    it("omits the postfix when the window is the synthetic fallback", () => {
      const ctx = makeCtx(undefined, {
        stdin: stdinWith({ usedPercentage: 18 }),
      });
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("18");
    });
  });

  describe("transcript fallback (older hosts without context_window)", () => {
    it("renders 0 with no events, plus the window postfix", () => {
      const ctx = makeCtx(makeSnapshot([]));
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("0 · 200k");
    });

    it("sums input + cached tokens (not output)", () => {
      const ctx = makeCtx(
        makeSnapshot([
          ev({ timestamp: 0, inputTokens: 1500, outputTokens: 9999, cachedTokens: 500 }),
        ]),
      );
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("2k · 200k");
    });

    it("formats large context lengths with k suffix", () => {
      const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0, inputTokens: 150_000 })]));
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("150k · 200k");
    });

    it("renders the window postfix as 1M for a 1M-token model window", () => {
      const ctx = makeCtx(
        makeSnapshot([ev({ timestamp: 0, inputTokens: 500 })], { contextWindow: 1_000_000 }),
      );
      const cell = contextLengthWidget.render(ctx, { options: {}, rawValue: false });
      expect(cell.text).toBe("500 · 1M");
    });
  });

  describe("label handling", () => {
    it("renders custom label when set", () => {
      const ctx = makeCtx(undefined, {
        stdin: stdinWith({ usedTokens: 500, windowSize: 200_000 }),
      });
      const cell = contextLengthWidget.render(ctx, {
        options: { label: "ctx:" },
        rawValue: false,
      });
      expect(cell.text).toBe("ctx:500 · 200k");
    });

    it("suppresses label when rawValue: true", () => {
      const ctx = makeCtx(undefined, {
        stdin: stdinWith({ usedTokens: 500, windowSize: 200_000 }),
      });
      const withLabel = contextLengthWidget.render(ctx, {
        options: { label: "ctx:" },
        rawValue: false,
      });
      const noLabel = contextLengthWidget.render(ctx, {
        options: { label: "ctx:" },
        rawValue: true,
      });
      expect(withLabel.text).toBe("ctx:500 · 200k");
      expect(noLabel.text).toBe("500 · 200k");
    });
  });
});
