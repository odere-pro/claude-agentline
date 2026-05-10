import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";

import { accountEmailWidget, maskEmail } from "./account-email.js";

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

describe("maskEmail", () => {
  it("returns full email when mode is none", () => {
    expect(maskEmail("user@example.com", "none")).toBe("user@example.com");
  });

  it("masks localpart when mode is domain", () => {
    expect(maskEmail("alice@example.com", "domain")).toBe("*@example.com");
  });

  it("masks domain when mode is localpart", () => {
    expect(maskEmail("alice@example.com", "localpart")).toBe("alice@*");
  });

  it("returns input unchanged for emails without a localpart", () => {
    expect(maskEmail("@example.com", "domain")).toBe("@example.com");
  });

  it("returns input unchanged for emails without a domain", () => {
    expect(maskEmail("user@", "domain")).toBe("user@");
  });

  it("returns input unchanged when no @ present", () => {
    expect(maskEmail("notanemail", "domain")).toBe("notanemail");
  });
});

describe("account-email widget", () => {
  it("hides when no email is available", () => {
    const cell = accountEmailWidget.render(makeCtx({}), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the full email by default (mask=none)", () => {
    const cell = accountEmailWidget.render(
      makeCtx({ accountEmail: "user@example.com" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("user@example.com");
  });

  it("applies domain mask when options.mask = domain", () => {
    const cell = accountEmailWidget.render(
      makeCtx({ accountEmail: "user@example.com" }),
      { options: { mask: "domain" }, rawValue: false },
    );
    expect(cell.text).toBe("*@example.com");
  });

  it("applies localpart mask when options.mask = localpart", () => {
    const cell = accountEmailWidget.render(
      makeCtx({ accountEmail: "user@example.com" }),
      { options: { mask: "localpart" }, rawValue: false },
    );
    expect(cell.text).toBe("user@*");
  });

  it("falls back to none mask for invalid mask value", () => {
    const cell = accountEmailWidget.render(
      makeCtx({ accountEmail: "user@example.com" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { options: { mask: "invalid" as any }, rawValue: false },
    );
    expect(cell.text).toBe("user@example.com");
  });

  it("renders custom label when set", () => {
    const cell = accountEmailWidget.render(
      makeCtx({ accountEmail: "u@test.com" }),
      { options: { label: "email:" }, rawValue: false },
    );
    expect(cell.text).toBe("email:u@test.com");
  });

  it("suppresses label when rawValue: true", () => {
    const withLabel = accountEmailWidget.render(
      makeCtx({ accountEmail: "u@test.com" }),
      { options: { label: "email:" }, rawValue: false },
    );
    const noLabel = accountEmailWidget.render(
      makeCtx({ accountEmail: "u@test.com" }),
      { options: { label: "email:" }, rawValue: true },
    );
    expect(withLabel.text).toBe("email:u@test.com");
    expect(noLabel.text).toBe("u@test.com");
  });
});
