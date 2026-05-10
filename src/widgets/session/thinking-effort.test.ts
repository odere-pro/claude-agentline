import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { thinkingEffortWidget } from "./thinking-effort.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(
  session: ResolvedSessionFields = {},
  stdinOverrides: Partial<StdinPayload> = {},
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: { ...baseStdin, ...stdinOverrides },
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T00:00:00Z"),
    env: {},
    session,
    ...overrides,
  };
}

describe("thinking-effort widget", () => {
  it("hides when no thinking effort is available", () => {
    const cell = thinkingEffortWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders 'low' with success colour", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "low" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("low");
    expect(cell.fg).toBe(DEFAULT_PALETTE.success);
  });

  it("renders 'medium' with info colour", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "medium" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("medium");
    expect(cell.fg).toBe(DEFAULT_PALETTE.info);
  });

  it("renders 'high' with warning colour", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "high" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("high");
    expect(cell.fg).toBe(DEFAULT_PALETTE.warning);
  });

  it("renders 'xhigh' with danger colour", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "xhigh" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("xhigh");
    expect(cell.fg).toBe(DEFAULT_PALETTE.danger);
  });

  it("renders unknown effort without colour", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "unknown" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("unknown");
    expect(cell.fg).toBeUndefined();
  });

  it("normalises case — 'LOW' renders as 'low' with success colour", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "LOW" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("low");
    expect(cell.fg).toBe(DEFAULT_PALETTE.success);
  });

  it("falls back to stdin.thinkingEffort when session is absent", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({}, { thinkingEffort: "medium" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("medium");
    expect(cell.fg).toBe(DEFAULT_PALETTE.info);
  });

  it("renders custom label when set", () => {
    const cell = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "high" }),
      { options: { label: "effort:" }, rawValue: false },
    );
    expect(cell.text).toBe("effort:high");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "low" }),
      { options: { label: "effort:" }, rawValue: false },
    );
    const noLabel = thinkingEffortWidget.render(
      makeCtx({ thinkingEffort: "low" }),
      { options: { label: "effort:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("effort:low");
    expect(noLabel.text).toBe("low");
  });
});
