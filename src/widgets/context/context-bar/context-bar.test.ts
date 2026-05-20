import { describe, expect, it } from "vitest";

import type { StdinPayload } from "../../../core/stdin/index.js";
import type { TokensSnapshot } from "../../../data/tokens/index.js";

import {
  makeStdinPayload,
  makeTokensSnapshot as makeSnapshot,
  makeTranscriptEvent as ev,
  makeWidgetContext,
} from "../../../test-helpers/index.js";
import type { WidgetContext } from "../../types.js";

import { contextBarWidget } from "./context-bar.js";

const stdinWithContext = (contextWindow: NonNullable<StdinPayload["contextWindow"]>): StdinPayload =>
  makeStdinPayload({ contextWindow });

const makeCtx = (snapshot: TokensSnapshot | undefined, overrides: Partial<WidgetContext> = {}) =>
  makeWidgetContext({ tokens: snapshot, ...overrides });

describe("context-bar widget", () => {
  it("hides when ctx.tokens is absent", () => {
    const cell = contextBarWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders a bar of the configured width (default 12) plus the window postfix", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.text).toMatch(/^.{12} · 200k$/u);
  });

  it("renders the bar with the custom width option", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 50_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 8, filled: "#", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("##...... · 200k");
  });

  it("renders a full bar at 100% usage", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 200_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 5, filled: "X", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("XXXXX · 200k");
  });

  it("renders an empty bar at 0% usage", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }));
    const cell = contextBarWidget.render(ctx, {
      options: { width: 5, filled: "X", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("..... · 200k");
  });

  it("emits no state-signal colour so the context family accent applies", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 180_000 })], { contextWindow: 200_000 }),
    );
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.fg).toBeUndefined();
    expect(cell.signal).toBeUndefined();
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

describe("context-bar — stdin priority branches", () => {
  it("prefers stdin.contextWindow.usedTokens over the local aggregate", () => {
    const ctx = makeCtx(
      // Aggregate alone would peg the bar full; stdin says 25%.
      makeSnapshot([ev({ timestamp: 0, inputTokens: 180_000 })], { contextWindow: 200_000 }),
      { stdin: stdinWithContext({ usedTokens: 50_000, windowSize: 200_000 }) },
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 8, filled: "#", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("##...... · 200k");
  });

  it("synthesises usage from usedPercentage when usedTokens is missing", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }), {
      stdin: stdinWithContext({ usedPercentage: 50, windowSize: 200_000 }),
    });
    const cell = contextBarWidget.render(ctx, {
      options: { width: 8, filled: "#", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("####.... · 200k");
  });

  it("hides when windowSize is zero (degenerate)", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 0 }), {
      stdin: { raw: {}, truncated: false },
    });
    const cell = contextBarWidget.render(ctx, { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("clamps to a full bar when used exceeds window (no overflow)", () => {
    const ctx = makeCtx(makeSnapshot([ev({ timestamp: 0 })], { contextWindow: 200_000 }), {
      stdin: stdinWithContext({ usedTokens: 1_000_000, windowSize: 200_000 }),
    });
    const cell = contextBarWidget.render(ctx, {
      options: { width: 5, filled: "X", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("XXXXX · 200k");
  });

  it("falls through to the legacy aggregate when neither usedTokens nor usedPercentage is set", () => {
    const ctx = makeCtx(
      makeSnapshot([ev({ timestamp: 0, inputTokens: 100_000 })], { contextWindow: 200_000 }),
      { stdin: { raw: {}, truncated: false } },
    );
    const cell = contextBarWidget.render(ctx, {
      options: { width: 4, filled: "#", empty: "." },
      rawValue: false,
    });
    expect(cell.text).toBe("##.. · 200k");
  });
});
