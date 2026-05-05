import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { sessionIdWidget } from "./session-id.js";

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

describe("session-id widget", () => {
  it("hides when no session id is available", () => {
    const cell = sessionIdWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("truncates to 8 characters by default", () => {
    const cell = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef0123456789" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("abcdef01");
  });

  it("respects options.length", () => {
    const cell = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef0123456789" }),
      { options: { length: 4 }, rawValue: false },
    );
    expect(cell.text).toBe("abcd");
  });

  it("ignores invalid options.length (negative)", () => {
    const cell = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef0123456789" }),
      { options: { length: -1 }, rawValue: false },
    );
    expect(cell.text).toBe("abcdef01");
  });

  it("ignores invalid options.length (zero)", () => {
    const cell = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef0123456789" }),
      { options: { length: 0 }, rawValue: false },
    );
    expect(cell.text).toBe("abcdef01");
  });

  it("falls back to stdin.sessionId when session.sessionId is absent", () => {
    const cell = sessionIdWidget.render(
      makeCtx({}, { sessionId: "xyz12345abcdef" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("xyz12345");
  });

  it("renders custom label when set", () => {
    const cell = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef01" }),
      { options: { label: "id:" }, rawValue: false },
    );
    expect(cell.text).toBe("id:abcdef01");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef01" }),
      { options: { label: "id:" }, rawValue: false },
    );
    const noLabel = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef01" }),
      { options: { label: "id:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("id:abcdef01");
    expect(noLabel.text).toBe("abcdef01");
  });
});
