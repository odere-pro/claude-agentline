import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import {
  DEFAULT_KEY_HINTS,
  keyHintsWidget,
  pickHintIndex,
} from "./key-hints.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-05-01T00:00:00Z"),
    env: {},
    ...overrides,
  };
}

describe("DEFAULT_KEY_HINTS", () => {
  it("is a non-empty frozen list of trimmed strings", () => {
    expect(Object.isFrozen(DEFAULT_KEY_HINTS)).toBe(true);
    expect(DEFAULT_KEY_HINTS.length).toBeGreaterThan(0);
    for (const hint of DEFAULT_KEY_HINTS) {
      expect(hint).toBe(hint.trim());
      expect(hint.length).toBeGreaterThan(0);
    }
  });
});

describe("pickHintIndex", () => {
  it("rotates by floor(now / intervalMs) modulo length", () => {
    const len = 4;
    const interval = 1_000;
    expect(pickHintIndex(0, interval, len)).toBe(0);
    expect(pickHintIndex(999, interval, len)).toBe(0);
    expect(pickHintIndex(1_000, interval, len)).toBe(1);
    expect(pickHintIndex(3_500, interval, len)).toBe(3);
    expect(pickHintIndex(4_000, interval, len)).toBe(0);
  });

  it("returns 0 for empty lists and handles non-finite clocks", () => {
    expect(pickHintIndex(123, 1_000, 0)).toBe(0);
    expect(pickHintIndex(Number.NaN, 1_000, 4)).toBe(0);
  });

  it("normalises negative slots to a non-negative index", () => {
    // A pre-epoch clock would otherwise give a negative modulus.
    expect(pickHintIndex(-1, 1_000, 4)).toBe(3);
  });
});

describe("keyHintsWidget", () => {
  it("renders a hint from the default catalogue", () => {
    const cell = keyHintsWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).not.toBe(true);
    expect(DEFAULT_KEY_HINTS).toContain(cell.text);
  });

  it("is deterministic under a frozen clock", () => {
    const ctx = makeCtx({ clock: frozenClock("2026-01-15T12:00:00Z") });
    const a = keyHintsWidget.render(ctx, { options: {}, rawValue: false });
    const b = keyHintsWidget.render(ctx, { options: {}, rawValue: false });
    expect(a.text).toBe(b.text);
  });

  it("rotates the hint as the clock advances past intervalMs", () => {
    const at0 = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(0) }),
      { options: { intervalMs: 1_000 }, rawValue: false },
    );
    const at1 = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(1_000) }),
      { options: { intervalMs: 1_000 }, rawValue: false },
    );
    const wrap = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(DEFAULT_KEY_HINTS.length * 1_000) }),
      { options: { intervalMs: 1_000 }, rawValue: false },
    );
    expect(at0.text).toBe(DEFAULT_KEY_HINTS[0]);
    expect(at1.text).toBe(DEFAULT_KEY_HINTS[1]);
    expect(wrap.text).toBe(DEFAULT_KEY_HINTS[0]);
  });

  it("uses caller-supplied hints when non-empty", () => {
    const cell = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(0) }),
      { options: { hints: ["A", "B", "C"], intervalMs: 1_000 }, rawValue: false },
    );
    expect(cell.text).toBe("A");
  });

  it("trims and skips blank user-supplied hints, falling back when all are empty", () => {
    const cell = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(0) }),
      { options: { hints: ["  ", ""] }, rawValue: false },
    );
    expect(DEFAULT_KEY_HINTS).toContain(cell.text);
  });

  it("clamps absurdly small intervals up to MIN_INTERVAL_MS so it can't rotate per render", () => {
    // intervalMs:1 would let now=0 vs now=1 land on different hints — we want it clamped to 1s.
    const a = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(0) }),
      { options: { hints: ["X", "Y"], intervalMs: 1 }, rawValue: false },
    );
    const b = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(500) }),
      { options: { hints: ["X", "Y"], intervalMs: 1 }, rawValue: false },
    );
    expect(a.text).toBe(b.text);
  });

  it("prepends the configured label", () => {
    const cell = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(0) }),
      { options: { label: "tip: ", hints: ["A"] }, rawValue: false },
    );
    expect(cell.text).toBe("tip: A");
  });

  it("suppresses the label when rawValue is true", () => {
    const cell = keyHintsWidget.render(
      makeCtx({ clock: frozenClock(0) }),
      { options: { label: "tip: ", hints: ["A"] }, rawValue: true },
    );
    expect(cell.text).toBe("A");
  });
});
