import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { sessionNameWidget } from "./session-name.js";

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

describe("session-name widget", () => {
  it("hides when no session name is available", () => {
    const cell = sessionNameWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the session name from session", () => {
    const cell = sessionNameWidget.render(
      makeCtx({ sessionName: "my-session" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("my-session");
  });

  it("falls back to stdin.sessionName when session.sessionName is absent", () => {
    const cell = sessionNameWidget.render(
      makeCtx({}, { sessionName: "stdin-session" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("stdin-session");
  });

  it("prefers session.sessionName over stdin.sessionName", () => {
    const cell = sessionNameWidget.render(
      makeCtx({ sessionName: "session-name" }, { sessionName: "stdin-name" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("session-name");
  });

  it("renders custom label when set", () => {
    const cell = sessionNameWidget.render(
      makeCtx({ sessionName: "ship-it" }),
      { options: { label: "name:" }, rawValue: false },
    );
    expect(cell.text).toBe("name:ship-it");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = sessionNameWidget.render(
      makeCtx({ sessionName: "ship-it" }),
      { options: { label: "name:" }, rawValue: false },
    );
    const noLabel = sessionNameWidget.render(
      makeCtx({ sessionName: "ship-it" }),
      { options: { label: "name:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("name:ship-it");
    expect(noLabel.text).toBe("ship-it");
  });
});
