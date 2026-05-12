import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { versionWidget } from "./version.js";

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

describe("version widget", () => {
  it("hides when no version is available", () => {
    const cell = versionWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders with default 'v' label prepended", () => {
    const cell = versionWidget.render(
      makeCtx({ version: "1.2.3" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("v1.2.3");
  });

  it("falls back to stdin.version when session.version is absent", () => {
    const cell = versionWidget.render(
      makeCtx({}, { version: "0.1.0" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("v0.1.0");
  });

  it("prefers session.version over stdin.version", () => {
    const cell = versionWidget.render(
      makeCtx({ version: "2.0.0" }, { version: "1.0.0" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("v2.0.0");
  });

  it("renders without 'v' prefix when rawValue: true (strips default label)", () => {
    const cell = versionWidget.render(
      makeCtx({ version: "1.0.0" }),
      { options: {}, rawValue: true },
    );
    expect(cell.text).toBe("1.0.0");
  });

  it("allows overriding the default 'v' label", () => {
    const cell = versionWidget.render(
      makeCtx({ version: "1.0.0" }),
      { options: { label: "ver " }, rawValue: false },
    );
    expect(cell.text).toBe("ver 1.0.0");
  });

  it("suppresses custom label when rawValue: true", () => {
    const withLabel = versionWidget.render(
      makeCtx({ version: "1.0.0" }),
      { options: { label: "ver:" }, rawValue: false },
    );
    const noLabel = versionWidget.render(
      makeCtx({ version: "1.0.0" }),
      { options: { label: "ver:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("ver:1.0.0");
    expect(noLabel.text).toBe("1.0.0");
  });
});
