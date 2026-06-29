/**
 * Consolidated test surface for every widget in `src/widgets/session/`
 * (PR E1 — test rationalisation).
 *
 * Per-widget files (account-email / model / plan / session-id /
 * thinking-effort / version) were folded in here because each
 * one repeated the same render contract — render a Cell, hide on no
 * data, honour `options.label` + `rawValue` — and re-tested helpers
 * already covered downstream.
 *
 * Grouping is by widget (each `describe` block scopes to one type).
 * Pure helpers (`maskEmail`, `modelDisplayName`) are tested as their
 * own `describe` blocks since they're independently exported.
 */
import { describe, expect, it } from "vitest";

import { makeGitSnapshot } from "../../test-helpers/index.js";
import { DEFAULT_CONFIG } from "../../data/config/index.js";
import type { ResolvedSessionFields } from "../../data/session/index.js";
import type { StdinPayload } from "../../core/stdin/index.js";
import { DEFAULT_PALETTE } from "../../data/theme/index.js";

import { frozenClock } from "../clock/clock.js";
import type { WidgetContext } from "../types.js";
import { WidgetRegistry } from "../registry/registry.js";
import { renderWidget } from "../render-widget/render-widget.js";

import { accountEmailWidget, maskEmail } from "./account-email.js";
import { modelDisplayName, modelWidget } from "./model.js";
import { planWidget } from "./plan.js";
import { pathBasename, projectWidget } from "./project.js";
import { sessionIdWidget } from "./session-id.js";
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
  it("registers exactly the 17 session widgets", () => {
    expect(registry.size()).toBe(17);
    expect(registry.list()).toEqual([
      "account-email",
      "added-dirs",
      "agent-name",
      "clock",
      "cwd-path",
      "lines-changed",
      "model",
      "output-style",
      "plan",
      "project",
      "project-dir",
      "session-duration",
      "session-id",
      "thinking-effort",
      "thinking-enabled",
      "version",
      "vim-mode",
    ]);
  });

  it("SESSION_WIDGETS is a frozen array", () => {
    expect(Object.isFrozen(SESSION_WIDGETS)).toBe(true);
    expect(SESSION_WIDGETS).toHaveLength(17);
  });
});

// ── model ────────────────────────────────────────────────────────────────

describe("modelDisplayName", () => {
  it("derives canonical names from the id without a per-model table row", () => {
    expect(modelDisplayName("claude-opus-4-8")).toBe("Opus 4.8");
    expect(modelDisplayName("claude-opus-4-7")).toBe("Opus 4.7");
    expect(modelDisplayName("claude-opus-4-6")).toBe("Opus 4.6");
    expect(modelDisplayName("claude-sonnet-4-6")).toBe("Sonnet 4.6");
    expect(modelDisplayName("claude-haiku-4-5")).toBe("Haiku 4.5");
  });

  it("derives a single-component version (e.g. Fable 5, Opus 3)", () => {
    expect(modelDisplayName("claude-fable-5")).toBe("Fable 5");
    expect(modelDisplayName("claude-opus-3")).toBe("Opus 3");
  });

  it("strips a trailing release-date segment", () => {
    expect(modelDisplayName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("strips a variant suffix like '[1m]'", () => {
    expect(modelDisplayName("claude-opus-4-8[1m]")).toBe("Opus 4.8");
  });

  it("falls back to the raw id for non-conforming models", () => {
    expect(modelDisplayName("unknown-future-model")).toBe("unknown-future-model");
  });

  it("leaves a non-claude id verbatim rather than mis-casing it", () => {
    // Only the `claude-` namespace is derived; everything else is shown raw.
    expect(modelDisplayName("gate-15")).toBe("gate-15");
    expect(modelDisplayName("gpt-4")).toBe("gpt-4");
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
    const cell = sessionIdWidget.render(makeCtx({ sessionId: "abcdef0123456789" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("abcdef01");
  });

  it("respects options.length", () => {
    const cell = sessionIdWidget.render(makeCtx({ sessionId: "abcdef0123456789" }), {
      options: { length: 4 },
      rawValue: false,
    });
    expect(cell.text).toBe("abcd");
  });

  it("ignores invalid options.length (negative)", () => {
    const cell = sessionIdWidget.render(makeCtx({ sessionId: "abcdef0123456789" }), {
      options: { length: -1 },
      rawValue: false,
    });
    expect(cell.text).toBe("abcdef01");
  });

  it("ignores invalid options.length (zero)", () => {
    const cell = sessionIdWidget.render(makeCtx({ sessionId: "abcdef0123456789" }), {
      options: { length: 0 },
      rawValue: false,
    });
    expect(cell.text).toBe("abcdef01");
  });

  it("hides when sessionId missing", () => {
    expect(sessionIdWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden).toBe(true);
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
    expect(accountEmailWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden).toBe(
      true,
    );
  });

  it("renders the full email by default (mask=none)", () => {
    const cell = accountEmailWidget.render(makeCtx({ accountEmail: "user@example.com" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("user@example.com");
  });

  it("applies domain mask when options.mask = domain", () => {
    const cell = accountEmailWidget.render(makeCtx({ accountEmail: "user@example.com" }), {
      options: { mask: "domain" },
      rawValue: false,
    });
    expect(cell.text).toBe("*@example.com");
  });

  it("applies localpart mask when options.mask = localpart", () => {
    const cell = accountEmailWidget.render(makeCtx({ accountEmail: "user@example.com" }), {
      options: { mask: "localpart" },
      rawValue: false,
    });
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
    const withLabel = accountEmailWidget.render(makeCtx({ accountEmail: "u@test.com" }), {
      options: { label: "email:" },
      rawValue: false,
    });
    const noLabel = accountEmailWidget.render(makeCtx({ accountEmail: "u@test.com" }), {
      options: { label: "email:" },
      rawValue: true,
    });
    expect(withLabel.text).toBe("email:u@test.com");
    expect(noLabel.text).toBe("u@test.com");
  });
});

// ── thinking-effort ──────────────────────────────────────────────────────

describe("thinking-effort widget", () => {
  it("hides when no thinking effort is available", () => {
    expect(thinkingEffortWidget.render(makeCtx(), { options: {}, rawValue: false }).hidden).toBe(
      true,
    );
  });

  it.each(["low", "medium", "high", "xhigh", "max"])(
    "renders '%s' as plain text with no state-signal colour (family accent applies)",
    (effort) => {
      const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: effort }), {
        options: {},
        rawValue: false,
      });
      expect(cell.text).toBe(effort);
      expect(cell.fg).toBeUndefined();
      expect(cell.signal).toBeUndefined();
    },
  );

  it("normalises 'MAX' to 'max' — the union/guard recognise the new top level", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "MAX" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("max");
  });

  it("renders unknown effort verbatim with no colour", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "unknown" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("unknown");
    expect(cell.fg).toBeUndefined();
  });

  it("normalises case — 'LOW' renders as 'low'", () => {
    const cell = thinkingEffortWidget.render(makeCtx({ thinkingEffort: "LOW" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("low");
  });

  it("falls back to stdin.thinkingEffort when session is absent", () => {
    const cell = thinkingEffortWidget.render(makeCtx({}, { thinkingEffort: "medium" }), {
      options: {},
      rawValue: false,
    });
    expect(cell.text).toBe("medium");
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

// ── plan ─────────────────────────────────────────────────────────────────

describe("plan widget", () => {
  it("renders the active plan name from ctx.plan", () => {
    const cell = planWidget.render(
      makeCtx({}, {}, { plan: { name: "my-feature", href: "file:///plans/my-feature.md" } }),
      {
        options: {},
        rawValue: false,
      },
    );
    expect(cell.text).toBe("my-feature");
  });

  it("exposes ctx.plan.href as the cell href so the name is a clickable link", () => {
    const cell = planWidget.render(
      makeCtx({}, {}, { plan: { name: "my-feature", href: "file:///plans/my-feature.md" } }),
      { options: {}, rawValue: false },
    );
    expect(cell.href).toBe("file:///plans/my-feature.md");
  });

  it("hides when ctx.plan is absent", () => {
    expect(planWidget.render(makeCtx({}), { options: {}, rawValue: false }).hidden).toBe(true);
  });

  it("hides when ctx.plan.name is empty", () => {
    expect(
      planWidget.render(makeCtx({}, {}, { plan: { name: "", href: "file:///plans/x.md" } }), {
        options: {},
        rawValue: false,
      }).hidden,
    ).toBe(true);
  });

  it("honours options.label and rawValue strips it", () => {
    const ctx = makeCtx({}, {}, { plan: { name: "p", href: "file:///plans/p.md" } });
    const withLabel = planWidget.render(ctx, { options: { label: "plan:" }, rawValue: false });
    const noLabel = planWidget.render(ctx, { options: { label: "plan:" }, rawValue: true });
    expect(withLabel.text).toBe("plan:p");
    expect(noLabel.text).toBe("p");
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

// ── pathBasename ───────────────────────────────────────────────────────────

describe("pathBasename", () => {
  it("returns the last segment of a posix path", () => {
    expect(pathBasename("/srv/me/Git/claude-agentline")).toBe("claude-agentline");
  });

  it("returns the last segment of a windows path", () => {
    expect(pathBasename("C:\\projects\\me\\agentline")).toBe("agentline");
  });

  it("ignores trailing separators", () => {
    expect(pathBasename("/srv/me/demo/")).toBe("demo");
  });

  it("returns empty string for the filesystem root", () => {
    expect(pathBasename("/")).toBe("");
  });

  it("returns empty string for an empty input", () => {
    expect(pathBasename("")).toBe("");
  });
});

// ── project ────────────────────────────────────────────────────────────────

describe("projectWidget", () => {
  it("shows the origin remote's repo name when the git snapshot has one", () => {
    const cell = projectWidget.render(
      makeCtx({}, { cwd: "/repo/worktrees/feature" }, {
        git: makeGitSnapshot({ origin: { owner: "acme", repo: "claude-agentline" } }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("claude-agentline");
    expect(cell.hidden).toBeFalsy();
  });

  it("falls back to the upstream remote's repo name when origin is null", () => {
    const cell = projectWidget.render(
      makeCtx({}, {}, {
        git: makeGitSnapshot({
          origin: null,
          upstreamRemote: { owner: "upstream-org", repo: "upstream-repo" },
        }),
      }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("upstream-repo");
  });

  it("falls back to the git cwd basename when no remote is configured", () => {
    const cell = projectWidget.render(
      makeCtx({}, {}, { git: makeGitSnapshot({ cwd: "/srv/me/local-only-project" }) }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("local-only-project");
  });

  it("falls back to the stdin cwd basename when git is unavailable", () => {
    const cell = projectWidget.render(
      makeCtx({}, { cwd: "/srv/me/no-git-here" }, { git: { available: false } }),
      { options: {}, rawValue: false },
    );
    expect(cell.text).toBe("no-git-here");
  });

  it("honours the label option and rawValue", () => {
    const ctx = makeCtx({}, {}, {
      git: makeGitSnapshot({ origin: { owner: "acme", repo: "widget-lab" } }),
    });
    expect(projectWidget.render(ctx, { options: { label: "📁 " }, rawValue: false }).text).toBe(
      "📁 widget-lab",
    );
    expect(projectWidget.render(ctx, { options: { label: "📁 " }, rawValue: true }).text).toBe(
      "widget-lab",
    );
  });

  it("hides when neither git nor stdin resolves a name", () => {
    const cell = projectWidget.render(makeCtx({}, {}, { git: { available: false } }), {
      options: {},
      rawValue: false,
    });
    expect(cell.hidden).toBe(true);
    expect(cell.text).toBe("");
  });
});
