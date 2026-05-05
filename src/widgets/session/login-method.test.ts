import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { loginMethodWidget } from "./login-method.js";

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

describe("login-method widget", () => {
  it("hides when no login method is available", () => {
    const cell = loginMethodWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders 'oauth' for oauth method", () => {
    const cell = loginMethodWidget.render(
      makeCtx({ loginMethod: "oauth" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("oauth");
  });

  it("normalises 'api_key' to 'api-key'", () => {
    const cell = loginMethodWidget.render(
      makeCtx({ loginMethod: "api_key" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("api-key");
  });

  it("normalises 'API_KEY' (uppercase) to 'api-key'", () => {
    const cell = loginMethodWidget.render(
      makeCtx({ loginMethod: "API_KEY" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("api-key");
  });

  it("renders 'enterprise' unchanged", () => {
    const cell = loginMethodWidget.render(
      makeCtx({ loginMethod: "enterprise" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("enterprise");
  });

  it("passes through unknown methods raw", () => {
    const cell = loginMethodWidget.render(
      makeCtx({ loginMethod: "saml" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("saml");
  });

  it("renders custom label when set", () => {
    const cell = loginMethodWidget.render(
      makeCtx({ loginMethod: "oauth" }),
      { options: { label: "auth:" }, rawValue: false },
    );
    expect(cell.text).toBe("auth:oauth");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = loginMethodWidget.render(
      makeCtx({ loginMethod: "oauth" }),
      { options: { label: "auth:" }, rawValue: false },
    );
    const noLabel = loginMethodWidget.render(
      makeCtx({ loginMethod: "oauth" }),
      { options: { label: "auth:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("auth:oauth");
    expect(noLabel.text).toBe("oauth");
  });
});
