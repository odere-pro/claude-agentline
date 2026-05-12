import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "../config/defaults.js";
import { defaultRegistry, registerAllBuiltins } from "../widgets/index.js";
import {
  DEMO_CLOCK_ISO,
  demoClock,
  demoContext,
  demoGit,
  demoSession,
  demoTokens,
  previewStatusline,
  previewWidget,
} from "./demo-fixture.js";

describe("demo fixture data", () => {
  it("is frozen and self-consistent", () => {
    expect(Object.isFrozen(demoTokens)).toBe(true);
    expect(Object.isFrozen(demoGit)).toBe(true);
    expect(Object.isFrozen(demoSession)).toBe(true);
    expect(demoGit).toMatchObject({ available: true, branch: "main" });
    expect(demoClock().now().toISOString()).toBe(DEMO_CLOCK_ISO);
  });

  it("builds a complete WidgetContext", () => {
    const ctx = demoContext();
    expect(ctx.stdin.model).toBeDefined();
    expect(ctx.tokens?.events.length).toBeGreaterThan(0);
    expect(ctx.git?.available).toBe(true);
    expect(ctx.session?.orgSlug).toBe("agentline");
  });
});

describe("previewWidget", () => {
  it("renders a data-bearing widget against the demo session", () => {
    expect(previewWidget("git-branch").text).toContain("main");
    expect(previewWidget("model").text.length).toBeGreaterThan(0);
    expect(previewWidget("tokens-total", { reset: "session" }).text).toMatch(/\d/);
  });

  it("hides an unknown widget type", () => {
    expect(previewWidget("does-not-exist")).toMatchObject({ hidden: true });
  });

  it("renders every built-in widget without throwing", () => {
    const registry = defaultRegistry();
    if (registry.size() === 0) registerAllBuiltins(registry);
    for (const type of registry.list()) {
      expect(() => previewWidget(type), type).not.toThrow();
    }
  });
});

describe("previewStatusline", () => {
  it("renders the default config into a non-empty, deterministic line", () => {
    const a = previewStatusline(DEFAULT_CONFIG);
    const b = previewStatusline(DEFAULT_CONFIG);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toBe(b);
    // DEFAULT_CONFIG is the minimal built-in (just `model`); it renders the model name.
    expect(a).toContain("Opus 4.7");
  });

  it("reflects the supplied config's widgets", () => {
    const line = previewStatusline({
      ...DEFAULT_CONFIG,
      lines: [{ widgets: [{ type: "git-branch" }, { type: "separator", options: { char: " | " } }, { type: "model" }] }],
    });
    expect(line).toContain("main");
  });
});
