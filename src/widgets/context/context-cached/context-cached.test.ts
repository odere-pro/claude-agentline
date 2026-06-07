/**
 * Tests for the `context-cached` widget (context family).
 *
 * Renders the session cached-token count (e.g. `0.8k cached`) from the
 * transcript snapshot — the same cached source `context-percentage`'s
 * `showCached` postfix uses. Hides without a snapshot or cached tokens.
 */

import { describe, expect, it } from "vitest";

import {
  frozenClock,
  makeTokensSnapshot,
  makeTranscriptEvent as ev,
  makeWidgetContext,
} from "../../../test-helpers/index.js";
import type { TokensSnapshot, TranscriptEvent } from "../../../data/tokens/index.js";
import type { WidgetContext } from "../../types.js";
import { contextCachedWidget } from "./context-cached.js";

const FIXED_NOW_MS = Date.parse("2026-05-01T03:00:00Z");

const makeSnapshot = (events: TranscriptEvent[], overrides: Partial<TokensSnapshot> = {}) =>
  makeTokensSnapshot(events, { now: FIXED_NOW_MS, ...overrides });

const makeCtx = (snapshot: TokensSnapshot | undefined, overrides: Partial<WidgetContext> = {}) =>
  makeWidgetContext({
    tokens: snapshot,
    clock: frozenClock(new Date(FIXED_NOW_MS)),
    ...overrides,
  });

describe("context-cached widget", () => {
  it("hides when there is no token snapshot", () => {
    const cell = contextCachedWidget.render(makeCtx(undefined), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });

  it("hides when the session has no cached tokens", () => {
    const snap = makeSnapshot([ev({ timestamp: FIXED_NOW_MS, inputTokens: 100, cachedTokens: 0 })]);
    const cell = contextCachedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the cached-token count with a 'cached' suffix", () => {
    const snap = makeSnapshot([
      ev({ timestamp: FIXED_NOW_MS, inputTokens: 100, cachedTokens: 800 }),
    ]);
    const cell = contextCachedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("800 cached");
    expect(cell.hidden).toBeFalsy();
  });

  it("formats large cached counts (k) like tokens-cached", () => {
    const snap = makeSnapshot([
      ev({ timestamp: FIXED_NOW_MS, inputTokens: 1, cachedTokens: 12_000 }),
    ]);
    const cell = contextCachedWidget.render(makeCtx(snap), { options: {}, rawValue: false });
    expect(cell.text).toBe("12k cached");
  });

  it("rawValue renders the bare count without the suffix or label", () => {
    const snap = makeSnapshot([
      ev({ timestamp: FIXED_NOW_MS, inputTokens: 1, cachedTokens: 800 }),
    ]);
    const cell = contextCachedWidget.render(makeCtx(snap), { options: {}, rawValue: true });
    expect(cell.text).toBe("800");
  });

  it("honours options.label when rawValue is false", () => {
    const snap = makeSnapshot([
      ev({ timestamp: FIXED_NOW_MS, inputTokens: 1, cachedTokens: 800 }),
    ]);
    const cell = contextCachedWidget.render(makeCtx(snap), {
      options: { label: "ctx " },
      rawValue: false,
    });
    expect(cell.text).toBe("ctx 800 cached");
  });
});
