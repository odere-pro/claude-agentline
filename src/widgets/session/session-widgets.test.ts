import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../../config/index.js";
import type { ResolvedSessionFields } from "../../session/index.js";
import type { StdinPayload } from "../../stdin/index.js";
import { DEFAULT_PALETTE } from "../../theme/index.js";

import { frozenClock } from "../clock.js";
import type { WidgetContext } from "../context.js";
import { WidgetRegistry } from "../registry.js";
import { renderWidget } from "../render-widget.js";

import { accountEmailWidget, maskEmail } from "./account-email.js";
import { modelDisplayName, modelWidget } from "./model.js";
import { sessionIdWidget } from "./session-id.js";
import { sessionNameWidget } from "./session-name.js";
import { skillsWidget } from "./skills.js";
import { thinkingEffortWidget } from "./thinking-effort.js";
import { versionWidget } from "./version.js";
import { registerSessionWidgets, SESSION_WIDGETS } from "./index.js";

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

const registry = new WidgetRegistry();
registerSessionWidgets(registry);

describe("registerSessionWidgets", () => {
  it("registers exactly the 7 session widgets", () => {
    expect(registry.size()).toBe(7);
    expect(registry.list()).toEqual([
      "account-email",
      "model",
      "session-id",
      "session-name",
      "skills",
      "thinking-effort",
      "version",
    ]);
  });

  it("SESSION_WIDGETS is a frozen array", () => {
    expect(Object.isFrozen(SESSION_WIDGETS)).toBe(true);
    expect(SESSION_WIDGETS).toHaveLength(7);
  });
});

describe("model widget", () => {
  it("renders the friendly display name for known ids", () => {
    expect(modelDisplayName("claude-opus-4-7")).toBe("Opus 4.7");
    expect(modelDisplayName("claude-sonnet-4-6")).toBe("Sonnet 4.6");
    expect(modelDisplayName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("falls back to the raw id for unknown models", () => {
    expect(modelDisplayName("future-x")).toBe("future-x");
  });

  it("hides when no model id is available", () => {
    const cell = modelWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("honours options.label", () => {
    const cell = modelWidget.render(makeCtx({ model: "claude-opus-4-7" }), {
      options: { label: "🤖 " },
      rawValue: false,
    });
    expect(cell.text).toBe("🤖 Opus 4.7");
  });

  it("rawValue suppresses the label", () => {
    const cell = modelWidget.render(makeCtx({ model: "claude-opus-4-7" }), {
      options: { label: "🤖 " },
      rawValue: true,
    });
    expect(cell.text).toBe("Opus 4.7");
  });
});

describe("version widget", () => {
  it("renders with default 'v' label", () => {
    const cell = versionWidget.render(makeCtx({ version: "0.1.0" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("v0.1.0");
  });

  it("hides when version is missing", () => {
    expect(versionWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden).toBe(true);
  });

  it("rawValue strips the label", () => {
    const cell = versionWidget.render(makeCtx({ version: "0.1.0" }), {
      options: {},
      rawValue: true,
    });
    expect(cell.text).toBe("0.1.0");
  });
});

describe("session-id widget", () => {
  it("truncates to 8 chars by default", () => {
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

  it("ignores invalid options.length", () => {
    const cell = sessionIdWidget.render(
      makeCtx({ sessionId: "abcdef0123456789" }),
      { options: { length: -1 }, rawValue: false },
    );
    expect(cell.text).toBe("abcdef01");
  });

  it("hides when sessionId missing", () => {
    expect(
      sessionIdWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });
});

describe("session-name widget", () => {
  it("renders when present", () => {
    const cell = sessionNameWidget.render(makeCtx({ sessionName: "ship-it" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("ship-it");
  });

  it("hides when empty / missing", () => {
    expect(
      sessionNameWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });
});

describe("account-email widget", () => {
  it("masks domain by default when mask=domain", () => {
    expect(maskEmail("alice@example.com", "domain")).toBe("*@example.com");
  });

  it("masks localpart when mask=localpart", () => {
    expect(maskEmail("alice@example.com", "localpart")).toBe("alice@*");
  });

  it("returns full email for mask=none", () => {
    expect(maskEmail("alice@example.com", "none")).toBe("alice@example.com");
  });

  it("returns input untouched for malformed addresses", () => {
    expect(maskEmail("not-an-email", "domain")).toBe("not-an-email");
    expect(maskEmail("@no-local.com", "domain")).toBe("@no-local.com");
    expect(maskEmail("no-domain@", "domain")).toBe("no-domain@");
  });

  it("widget renders with default mask=none", () => {
    const cell = accountEmailWidget.render(makeCtx({ accountEmail: "u@example.com" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("u@example.com");
  });

  it("widget honours options.mask", () => {
    const cell = accountEmailWidget.render(makeCtx({ accountEmail: "u@example.com" }), {
      options: { mask: "domain" },
      rawValue: false,
    });
    expect(cell.text).toBe("*@example.com");
  });

  it("widget hides when no email available", () => {
    expect(
      accountEmailWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });
});

describe("thinking-effort widget", () => {
  it("renders with the success role colour for low", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "low" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("low");
    expect(cell.fg).toBe(DEFAULT_PALETTE.success);
  });

  it("renders with the danger role colour for xhigh", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "xhigh" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE.danger);
  });

  it("renders unknown effort without colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "unknown" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("unknown");
    expect(cell.fg).toBeUndefined();
  });
});

describe("skills widget", () => {
  it("count variant renders the cardinality", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b", "c"] }), {
      options: { variant: "count" },
      rawValue: false,
    });
    expect(cell.text).toBe("3");
  });

  it("list variant joins names", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b", "c"] }), {
      options: { variant: "list" },
      rawValue: false,
    });
    expect(cell.text).toBe("a, b, c");
  });

  it("last variant returns trailing entry", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b", "c"] }), {
      options: { variant: "last" },
      rawValue: false,
    });
    expect(cell.text).toBe("c");
  });

  it("hides when skills empty", () => {
    expect(
      skillsWidget.render(makeCtx({ skills: [] }), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("custom listSeparator", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b"] }), {
      options: { variant: "list", listSeparator: " | " },
      rawValue: false,
    });
    expect(cell.text).toBe("a | b");
  });
});

describe("renderWidget integration", () => {
  it("widget config 'hidden' overrides any session value", () => {
    const cell = renderWidget(
      registry,
      { type: "model", hidden: true },
      makeCtx({ model: "claude-opus-4-7" }),
    );
    expect(cell.hidden).toBe(true);
  });

  it("widget config fg overrides the widget's emitted colour", () => {
    const cell = renderWidget(
      registry,
      { type: "thinking-effort", fg: "#abcdef" },
      makeCtx({ thinkingEffort: "high" }),
    );
    expect(cell.fg).toBe("#abcdef");
  });
});
