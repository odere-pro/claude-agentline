/**
 * Round-trip tests for all shipped config templates
 * (`templates/*.config.json`).
 *
 * The templates are the source of truth for what
 * `agentline config init --preset <name>` seeds into a fresh user config
 * dir. The tests assert that:
 *
 *   1. Each template parses as JSON.
 *   2. Each template validates against the embedded JSON Schema.
 *   3. Each template only references widget types present in the current
 *      catalogue (no removed types).
 *   4. The default template carries its specific shipped three-line layout.
 *   5. The minimal template carries exactly one line.
 *   6. The power template carries at least three lines.
 *
 * Failing here means a template and the schema have drifted apart, or a
 * removed widget type was left in a preset; fix the offender before shipping.
 */

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateConfig } from "./validate/validate.js";
import { WIDGET_CATALOG } from "../../widgets/families/catalog.js";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

async function loadTemplate(name: string): Promise<unknown> {
  const text = await fs.readFile(resolve(repoRoot, "templates", name), "utf8");
  return JSON.parse(text);
}

type ConfigShape = {
  lines: { widgets: { type: string; options?: Record<string, unknown> }[] }[];
  theme: string | null;
  powerline: { enabled: boolean };
};

// ── default.config.json ───────────────────────────────────────────────────────

describe("shipped config template — default", () => {
  it("default.config.json parses as JSON", async () => {
    const v = await loadTemplate("default.config.json");
    expect(typeof v).toBe("object");
    expect(v).not.toBeNull();
  });

  it("default.config.json validates against the schema", async () => {
    const v = await loadTemplate("default.config.json");
    expect(() => validateConfig(v)).not.toThrow();
  });

  it("default.config.json carries the shipped three-line widget layout", async () => {
    const cfg = (await loadTemplate("default.config.json")) as ConfigShape;
    const layout = cfg.lines.map((l) => l.widgets.map((w) => w.type));
    expect(layout).toEqual([
      ["model", "thinking-effort", "git-branch", "git-changes"],
      ["context-percentage", "token-speed", "tokens"],
      ["session-weekly-usage", "current-session-reset-timer", "week-limit-timer"],
    ]);
    const tokens = cfg.lines[1]!.widgets.find((w) => w.type === "tokens");
    expect(tokens?.options?.reset).toBe("block");
    expect(cfg.theme).toBe("claude-code-dark");
    expect(cfg.powerline.enabled).toBe(false);
  });

  it("default.config.json references an installed theme", async () => {
    const themesDir = resolve(repoRoot, "themes");
    const installed = (await fs.readdir(themesDir))
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.replace(/\.json$/, ""));
    const cfg = (await loadTemplate("default.config.json")) as { theme: string | null };
    if (cfg.theme) expect(installed).toContain(cfg.theme);
  });

  it("default.config.json only references widget types in the current catalogue", async () => {
    const cfg = (await loadTemplate("default.config.json")) as ConfigShape;
    const allTypes = cfg.lines.flatMap((l) => l.widgets.map((w) => w.type));
    for (const type of allTypes) {
      expect(
        WIDGET_CATALOG[type],
        `default template references removed type '${type}'`,
      ).toBeDefined();
    }
  });
});

// ── minimal.config.json ───────────────────────────────────────────────────────

describe("shipped config template — minimal", () => {
  it("minimal.config.json parses as JSON", async () => {
    const v = await loadTemplate("minimal.config.json");
    expect(typeof v).toBe("object");
    expect(v).not.toBeNull();
  });

  it("minimal.config.json validates against the schema", async () => {
    const v = await loadTemplate("minimal.config.json");
    expect(() => validateConfig(v)).not.toThrow();
  });

  it("minimal.config.json has exactly one line", async () => {
    const cfg = (await loadTemplate("minimal.config.json")) as ConfigShape;
    expect(cfg.lines).toHaveLength(1);
  });

  it("minimal.config.json only references widget types in the current catalogue", async () => {
    const cfg = (await loadTemplate("minimal.config.json")) as ConfigShape;
    const allTypes = cfg.lines.flatMap((l) => l.widgets.map((w) => w.type));
    expect(allTypes.length).toBeGreaterThan(0);
    for (const type of allTypes) {
      expect(
        WIDGET_CATALOG[type],
        `minimal template references removed type '${type}'`,
      ).toBeDefined();
    }
  });
});

// ── power.config.json ─────────────────────────────────────────────────────────

describe("shipped config template — power", () => {
  it("power.config.json parses as JSON", async () => {
    const v = await loadTemplate("power.config.json");
    expect(typeof v).toBe("object");
    expect(v).not.toBeNull();
  });

  it("power.config.json validates against the schema", async () => {
    const v = await loadTemplate("power.config.json");
    expect(() => validateConfig(v)).not.toThrow();
  });

  it("power.config.json has at least three lines", async () => {
    const cfg = (await loadTemplate("power.config.json")) as ConfigShape;
    expect(cfg.lines.length).toBeGreaterThanOrEqual(3);
  });

  it("power.config.json only references widget types in the current catalogue", async () => {
    const cfg = (await loadTemplate("power.config.json")) as ConfigShape;
    const allTypes = cfg.lines.flatMap((l) => l.widgets.map((w) => w.type));
    expect(allTypes.length).toBeGreaterThan(0);
    for (const type of allTypes) {
      expect(
        WIDGET_CATALOG[type],
        `power template references removed type '${type}'`,
      ).toBeDefined();
    }
  });
});
