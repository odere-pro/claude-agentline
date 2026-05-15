import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import type { TokensSnapshot } from "../../tokens/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { uptimeBlockWidget, uptimeSessionWidget } from "./uptime.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeSnapshot(now: number, sessionStart: number, blockAnchor?: number): TokensSnapshot {
  return Object.freeze({
    events: [],
    now,
    sessionStart,
    blockAnchor: blockAnchor ?? sessionStart,
    contextWindow: 200_000,
    pricingVersion: "test",
  });
}

function makeCtx(
  at: string,
  snapshot?: TokensSnapshot,
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock(at),
    env: {},
    tokens: snapshot,
    ...overrides,
  };
}

describe("uptime-session widget", () => {
  it("hides when no snapshot is available", () => {
    const cell = uptimeSessionWidget.render(makeCtx("2026-05-01T00:30:00Z"), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
  });

  it("renders elapsed time since sessionStart", () => {
    const sessionStart = Date.parse("2026-05-01T00:00:00Z");
    const now = sessionStart + 3 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const snap = makeSnapshot(now, sessionStart);
    const cell = uptimeSessionWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("3h30m");
  });

  it("renders 0m for zero elapsed time", () => {
    const sessionStart = Date.parse("2026-05-01T00:00:00Z");
    const snap = makeSnapshot(sessionStart, sessionStart);
    const cell = uptimeSessionWidget.render(makeCtx(new Date(sessionStart).toISOString(), snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("0m");
  });

  it("renders in clock format when options.format = clock", () => {
    const sessionStart = Date.parse("2026-05-01T00:00:00Z");
    const now = sessionStart + 90 * 60 * 1000;
    const snap = makeSnapshot(now, sessionStart);
    const cell = uptimeSessionWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { format: "clock" },
      rawValue: false,
    });
    expect(cell.text).toBe("01:30:00");
  });

  it("renders custom label", () => {
    const sessionStart = Date.parse("2026-05-01T00:00:00Z");
    const now = sessionStart + 60 * 60 * 1000;
    const snap = makeSnapshot(now, sessionStart);
    const cell = uptimeSessionWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { label: "up:" },
      rawValue: false,
    });
    expect(cell.text).toBe("up:1h0m");
  });

  it("suppresses label when rawValue: true", () => {
    const sessionStart = Date.parse("2026-05-01T00:00:00Z");
    const now = sessionStart + 60 * 60 * 1000;
    const snap = makeSnapshot(now, sessionStart);
    const withLabel = uptimeSessionWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { label: "up:" },
      rawValue: false,
    });
    const noLabel = uptimeSessionWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { label: "up:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("up:1h0m");
    expect(noLabel.text).toBe("1h0m");
  });
});

describe("uptime-block widget", () => {
  it("renders 0m when no snapshot is present (falls back to current clock)", () => {
    const cell = uptimeBlockWidget.render(makeCtx("2026-05-01T00:00:00Z"), {
      options: {},
      rawValue: false,
    });
    /*
     * Without a snapshot blockAnchor defaults to undefined → blockStart uses now
     * so elapsed = 0
     */
    expect(cell.text).toBe("0m");
  });

  it("resets at the 5-h boundary", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 6 * 60 * 60 * 1000; // 1h into second block
    const snap = makeSnapshot(now, anchor, anchor);
    const cell = uptimeBlockWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("1h0m");
  });

  it("renders clock format for block uptime", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 90 * 60 * 1000;
    const snap = makeSnapshot(now, anchor, anchor);
    const cell = uptimeBlockWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { format: "clock" },
      rawValue: false,
    });
    expect(cell.text).toBe("01:30:00");
  });

  it("renders custom label", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 30 * 60 * 1000;
    const snap = makeSnapshot(now, anchor, anchor);
    const cell = uptimeBlockWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { label: "blk:" },
      rawValue: false,
    });
    expect(cell.text).toBe("blk:30m");
  });

  it("suppresses label when rawValue: true", () => {
    const anchor = Date.parse("2026-05-01T00:00:00Z");
    const now = anchor + 30 * 60 * 1000;
    const snap = makeSnapshot(now, anchor, anchor);
    const withLabel = uptimeBlockWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { label: "blk:" },
      rawValue: false,
    });
    const noLabel = uptimeBlockWidget.render(makeCtx(new Date(now).toISOString(), snap), {
      options: { label: "blk:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("blk:30m");
    expect(noLabel.text).toBe("30m");
  });
});
