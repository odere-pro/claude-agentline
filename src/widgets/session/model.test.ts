import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { modelDisplayName, modelWidget } from "./model.js";

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

describe("modelDisplayName", () => {
  it("maps claude-opus-4-7 to 'Opus 4.7'", () => {
    expect(modelDisplayName("claude-opus-4-7")).toBe("Opus 4.7");
  });

  it("maps claude-sonnet-4-6 to 'Sonnet 4.6'", () => {
    expect(modelDisplayName("claude-sonnet-4-6")).toBe("Sonnet 4.6");
  });

  it("maps claude-haiku-4-5 to 'Haiku 4.5'", () => {
    expect(modelDisplayName("claude-haiku-4-5")).toBe("Haiku 4.5");
  });

  it("maps the dated haiku variant to 'Haiku 4.5'", () => {
    expect(modelDisplayName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("falls back to the raw id for unknown models", () => {
    expect(modelDisplayName("unknown-future-model")).toBe("unknown-future-model");
  });

  it("returns empty string unchanged", () => {
    expect(modelDisplayName("")).toBe("");
  });
});

describe("model widget", () => {
  it("hides when no model id is available", () => {
    const cell = modelWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the friendly display name from session.model", () => {
    const cell = modelWidget.render(
      makeCtx({ model: "claude-opus-4-7" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("Opus 4.7");
  });

  it("falls back to stdin.model when session.model is absent", () => {
    const cell = modelWidget.render(
      makeCtx({}, { model: "claude-sonnet-4-6" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("Sonnet 4.6");
  });

  it("applies accent colour", () => {
    const cell = modelWidget.render(
      makeCtx({ model: "claude-opus-4-7" }),
      { options: {}, rawValue: false },
    );
    expect(cell.fg).toBe(DEFAULT_PALETTE.accent);
  });

  it("renders custom label when set", () => {
    const cell = modelWidget.render(
      makeCtx({ model: "claude-opus-4-7" }),
      { options: { label: "model:" }, rawValue: false },
    );
    expect(cell.text).toBe("model:Opus 4.7");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = modelWidget.render(
      makeCtx({ model: "claude-opus-4-7" }),
      { options: { label: "model:" }, rawValue: false },
    );
    const noLabel = modelWidget.render(
      makeCtx({ model: "claude-opus-4-7" }),
      { options: { label: "model:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("model:Opus 4.7");
    expect(noLabel.text).toBe("Opus 4.7");
  });
});
