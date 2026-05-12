import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { outputStyleWidget } from "./output-style.js";

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

describe("output-style widget", () => {
  it("hides when no output style is available", () => {
    const cell = outputStyleWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the output style from session", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "concise" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("concise");
  });

  it("renders the output style from stdin as fallback", () => {
    const cell = outputStyleWidget.render(
      makeCtx({}, { outputStyle: "verbose" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("verbose");
  });

  it("prefers session.outputStyle over stdin.outputStyle", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "concise" }, { outputStyle: "verbose" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("concise");
  });

  it("renders custom label when set", () => {
    const cell = outputStyleWidget.render(
      makeCtx({ outputStyle: "concise" }),
      { options: { label: "style:" }, rawValue: false },
    );
    expect(cell.text).toBe("style:concise");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = outputStyleWidget.render(
      makeCtx({ outputStyle: "concise" }),
      { options: { label: "style:" }, rawValue: false },
    );
    const noLabel = outputStyleWidget.render(
      makeCtx({ outputStyle: "concise" }),
      { options: { label: "style:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("style:concise");
    expect(noLabel.text).toBe("concise");
  });
});
