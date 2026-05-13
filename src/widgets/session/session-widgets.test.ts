/**
 * Consolidated test surface for every widget in `src/widgets/session/`
 * (PR E1 — test rationalisation).
 *
 * Per-widget files (account-email / model / session-id / session-name /
 * skills / thinking-effort / version) were folded in here because each
 * one repeated the same render contract — render a Cell, hide on no
 * data, honour `options.label` + `rawValue` — and re-tested helpers
 * already covered downstream.
 *
 * Grouping is by widget (each `describe` block scopes to one type).
 * Pure helpers (`maskEmail`, `modelDisplayName`) are tested as their
 * own `describe` blocks since they're independently exported.
 */
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

// ── model ────────────────────────────────────────────────────────────────

describe("modelDisplayName", () => {
  it("maps the canonical model ids to their friendly labels", () => {
    expect(modelDisplayName("claude-opus-4-7")).toBe("Opus 4.7");
    expect(modelDisplayName("claude-sonnet-4-6")).toBe("Sonnet 4.6");
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
    const cell = modelWidget.render(makeCtx(), { options: {}, rawValue: false });
    expect(cell.hidden).toBe(true);
  });

  it("renders the friendly display name from session.model", () => {
    const cell = modelWidget.render(makeCtx({ model: "claude-opus-4-7" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("Opus 4.7");
  });

  it("falls back to stdin.model when session.model is absent", () => {
    const cell = modelWidget.render(makeCtx({}, { model: "claude-sonnet-4-6" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("Sonnet 4.6");
  });

  it("applies accent colour", () => {
    const cell = modelWidget.render(makeCtx({ model: "claude-opus-4-7" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.fg).toBe(DEFAULT_PALETTE.accent);
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

// ── version ──────────────────────────────────────────────────────────────

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

  it("rawValue strips the default 'v' prefix", () => {
    const cell = versionWidget.render(makeCtx({ version: "0.1.0" }), {
      options: {},
      rawValue: true,
    });
    expect(cell.text).toBe("0.1.0");
  });

  it("falls back to stdin.version when session.version is absent", () => {
    const cell = versionWidget.render(makeCtx({}, { version: "0.1.0" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("v0.1.0");
  });

  it("prefers session.version over stdin.version", () => {
    const cell = versionWidget.render(makeCtx({ version: "2.0.0" }, { version: "1.0.0" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("v2.0.0");
  });

  it("allows overriding the default 'v' label", () => {
    const cell = versionWidget.render(makeCtx({ version: "1.0.0" }), {
      options: { label: "ver " },
      rawValue: false,
    });
    expect(cell.text).toBe("ver 1.0.0");
  });

  it("suppresses custom label when rawValue: true", () => {
    const cell = versionWidget.render(makeCtx({ version: "1.0.0" }), {
      options: { label: "ver:" },
      rawValue: true,
    });
    expect(cell.text).toBe("1.0.0");
  });
});

// ── session-id ───────────────────────────────────────────────────────────

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

  it("hides when sessionId missing", () => {
    expect(
      sessionIdWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("falls back to stdin.sessionId when session.sessionId is absent", () => {
    const cell = sessionIdWidget.render(makeCtx({}, { sessionId: "xyz12345abcdef" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("xyz12345");
  });

  it("honours options.label and rawValue strips it", () => {
    const withLabel = sessionIdWidget.render(makeCtx({ sessionId: "abcdef01" }), {
      options: { label: "id:" },
      rawValue: false,
    });
    const noLabel = sessionIdWidget.render(makeCtx({ sessionId: "abcdef01" }), {
      options: { label: "id:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("id:abcdef01");
    expect(noLabel.text).toBe("abcdef01");
  });
});

// ── session-name ─────────────────────────────────────────────────────────

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

  it("falls back to stdin.sessionName when session.sessionName is absent", () => {
    const cell = sessionNameWidget.render(makeCtx({}, { sessionName: "stdin-session" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("stdin-session");
  });

  it("prefers session.sessionName over stdin.sessionName", () => {
    const cell = sessionNameWidget.render(
      makeCtx({ sessionName: "session-name" }, { sessionName: "stdin-name" }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("session-name");
  });

  it("honours options.label and rawValue strips it", () => {
    const withLabel = sessionNameWidget.render(makeCtx({ sessionName: "ship-it" }), {
      options: { label: "name:" },
      rawValue: false,
    });
    const noLabel = sessionNameWidget.render(makeCtx({ sessionName: "ship-it" }), {
      options: { label: "name:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("name:ship-it");
    expect(noLabel.text).toBe("ship-it");
  });
});

// ── account-email ────────────────────────────────────────────────────────

describe("maskEmail", () => {
  it("returns full email when mode is none", () => {
    expect(maskEmail("alice@example.com", "none")).toBe("alice@example.com");
  });

  it("masks localpart when mode is domain", () => {
    expect(maskEmail("alice@example.com", "domain")).toBe("*@example.com");
  });

  it("masks domain when mode is localpart", () => {
    expect(maskEmail("alice@example.com", "localpart")).toBe("alice@*");
  });

  it("returns input untouched for malformed addresses (no localpart / no domain / no @)", () => {
    expect(maskEmail("@example.com", "domain")).toBe("@example.com");
    expect(maskEmail("user@", "domain")).toBe("user@");
    expect(maskEmail("notanemail", "domain")).toBe("notanemail");
  });
});

describe("account-email widget", () => {
  it("hides when no email is available", () => {
    expect(
      accountEmailWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
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

  it("falls back to none mask for an invalid mask value", () => {
    const cell = accountEmailWidget.render(
      makeCtx({ accountEmail: "user@example.com" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { options: { mask: "invalid" as any }, rawValue: false },
    );
    expect(cell.text).toBe("user@example.com");
  });

  it("honours options.label and rawValue strips it", () => {
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

// ── thinking-effort ──────────────────────────────────────────────────────

describe("thinking-effort widget", () => {
  it("hides when no thinking effort is available", () => {
    expect(
      thinkingEffortWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("renders 'low' with success colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "low" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("low");
    expect(cell.fg).toBe(DEFAULT_PALETTE.success);
  });

  it("renders 'medium' with info colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "medium" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("medium");
    expect(cell.fg).toBe(DEFAULT_PALETTE.info);
  });

  it("renders 'high' with warning colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "high" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("high");
    expect(cell.fg).toBe(DEFAULT_PALETTE.warning);
  });

  it("renders 'xhigh' with danger colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "xhigh" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("xhigh");
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

  it("normalises case — 'LOW' renders as 'low' with success colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "LOW" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("low");
    expect(cell.fg).toBe(DEFAULT_PALETTE.success);
  });

  it("falls back to stdin.thinkingEffort when session is absent", () => {
    const cell = thinkingEffortWidget.render(makeCtx({}, { thinkingEffort: "medium" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("medium");
    expect(cell.fg).toBe(DEFAULT_PALETTE.info);
  });

  it("honours options.label and rawValue strips it", () => {
    const withLabel = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "high" }), {
      options: { label: "effort:" },
      rawValue: false,
    });
    const noLabel = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "low" }), {
      options: { label: "effort:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("effort:high");
    expect(noLabel.text).toBe("low");
  });
});

// ── skills ───────────────────────────────────────────────────────────────

describe("skills widget", () => {
  it("count variant renders the cardinality", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b", "c"] }), {
      options: { variant: "count" },
      rawValue: false,
    });
    expect(cell.text).toBe("3");
  });

  it("renders count variant by default (no variant set)", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["tdd", "refactor", "review"] }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("3");
  });

  it("single skill count is 1", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["only-one"] }), {
      options: { variant: "count" },
      rawValue: false,
    });
    expect(cell.text).toBe("1");
  });

  it("list variant joins names with comma by default", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b", "c"] }), {
      options: { variant: "list" },
      rawValue: false,
    });
    expect(cell.text).toBe("a, b, c");
  });

  it("list variant respects custom listSeparator", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b"] }), {
      options: { variant: "list", listSeparator: " | " },
      rawValue: false,
    });
    expect(cell.text).toBe("a | b");
  });

  it("last variant returns trailing entry", () => {
    const cell = skillsWidget.render(makeCtx({ skills: ["a", "b", "c"] }), {
      options: { variant: "last" },
      rawValue: false,
    });
    expect(cell.text).toBe("c");
  });

  it("falls back to count for an unknown variant", () => {
    const cell = skillsWidget.render(
      makeCtx({ skills: ["x", "y"] }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { options: { variant: "unknown" as any }, rawValue: false },
    );
    expect(cell.text).toBe("2");
  });

  it("hides when skills is an empty array", () => {
    expect(
      skillsWidget.render(makeCtx({ skills: [] }), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("hides when skills is absent from session", () => {
    expect(
      skillsWidget.render(makeCtx({}), { options: {}, rawValue: false }).hidden,
    ).toBe(true);
  });

  it("honours options.label and rawValue strips it", () => {
    const withLabel = skillsWidget.render(makeCtx({ skills: ["a"] }), {
      options: { label: "s:" },
      rawValue: false,
    });
    const noLabel = skillsWidget.render(makeCtx({ skills: ["a"] }), {
      options: { label: "s:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("s:1");
    expect(noLabel.text).toBe("1");
  });
});

// ── renderWidget overrides ───────────────────────────────────────────────

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
