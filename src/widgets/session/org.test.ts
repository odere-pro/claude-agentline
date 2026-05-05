import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { orgWidget } from "./org.js";

const baseStdin: StdinPayload = { raw: {}, truncated: false };

function makeCtx(
  session: ResolvedSessionFields = {},
  overrides: Partial<WidgetContext> = {},
): WidgetContext {
  return {
    stdin: baseStdin,
    config: DEFAULT_CONFIG,
    theme: null,
    clock: frozenClock("2026-01-15T00:00:00Z"),
    env: {},
    session,
    ...overrides,
  };
}

describe("org widget", () => {
  it("hides when no org slug is available", () => {
    const cell = orgWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the org slug", () => {
    const cell = orgWidget.render(
      makeCtx({ orgSlug: "anthropic" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("anthropic");
  });

  it("renders a hyphenated slug correctly", () => {
    const cell = orgWidget.render(
      makeCtx({ orgSlug: "my-org-name" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("my-org-name");
  });

  it("renders custom label when set", () => {
    const cell = orgWidget.render(
      makeCtx({ orgSlug: "anthropic" }),
      { options: { label: "org:" }, rawValue: false },
    );
    expect(cell.text).toBe("org:anthropic");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = orgWidget.render(
      makeCtx({ orgSlug: "anthropic" }),
      { options: { label: "org:" }, rawValue: false },
    );
    const noLabel = orgWidget.render(
      makeCtx({ orgSlug: "anthropic" }),
      { options: { label: "org:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("org:anthropic");
    expect(noLabel.text).toBe("anthropic");
  });
});
