import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { vimModeWidget } from "./vim-mode.js";

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

describe("vim-mode widget", () => {
  it("hides when no vim mode is available", () => {
    const cell = vimModeWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders long format (uppercase) by default", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "normal" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("NORMAL");
  });

  it("long format normalises to uppercase", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "insert" }),
      { options: { format: "long" }, rawValue: false },
    );
    expect(cell.text).toBe("INSERT");
  });

  it("short format renders first character only", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "VISUAL" }),
      { options: { format: "short" }, rawValue: false },
    );
    expect(cell.text).toBe("V");
  });

  it("short format for INSERT renders 'I'", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "INSERT" }),
      { options: { format: "short" }, rawValue: false },
    );
    expect(cell.text).toBe("I");
  });

  it("bracket format wraps first character in brackets", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "VISUAL" }),
      { options: { format: "bracket" }, rawValue: false },
    );
    expect(cell.text).toBe("[V]");
  });

  it("bracket format for NORMAL renders '[N]'", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "NORMAL" }),
      { options: { format: "bracket" }, rawValue: false },
    );
    expect(cell.text).toBe("[N]");
  });

  it("falls back to long format for unknown format value", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "NORMAL" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { options: { format: "invalid" as any }, rawValue: false },
    );
    expect(cell.text).toBe("NORMAL");
  });

  it("falls back to stdin.vimMode when session.vimMode is absent", () => {
    const cell = vimModeWidget.render(
      makeCtx({}, { vimMode: "INSERT" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("INSERT");
  });

  it("renders custom label when set", () => {
    const cell = vimModeWidget.render(
      makeCtx({ vimMode: "NORMAL" }),
      { options: { label: "vim:" }, rawValue: false },
    );
    expect(cell.text).toBe("vim:NORMAL");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = vimModeWidget.render(
      makeCtx({ vimMode: "NORMAL" }),
      { options: { label: "vim:" }, rawValue: false },
    );
    const noLabel = vimModeWidget.render(
      makeCtx({ vimMode: "NORMAL" }),
      { options: { label: "vim:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("vim:NORMAL");
    expect(noLabel.text).toBe("NORMAL");
  });
});
