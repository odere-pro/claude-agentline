/**
 * Round-trip tests for the shipped templates (`templates/*.json`).
 *
 * Each template is the source of truth for what `scripts/install.sh`
 * (default) and `agentline config init --minimal` write to a fresh user
 * config dir. The tests assert that:
 *
 *   1. Each template parses as JSON.
 *   2. Each template validates against the embedded JSON Schema.
 *   3. The default template's first line matches the §7.10 widget set,
 *      with `tokens-total` / `cost` / `session-usage` declaring
 *      `reset: block` and the theme set to `claude-code-dark`.
 *
 * Failing here means the templates and the schema have drifted apart;
 * fix the offender before shipping.
 */

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateConfig } from "./validate.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function loadTemplate(name: string): Promise<unknown> {
  const text = await fs.readFile(resolve(repoRoot, "templates", name), "utf8");
  return JSON.parse(text);
}

describe("shipped config templates", () => {
  it("default.config.json parses as JSON", async () => {
    const v = await loadTemplate("default.config.json");
    expect(typeof v).toBe("object");
    expect(v).not.toBeNull();
  });

  it("default.config.json validates against the schema", async () => {
    const v = await loadTemplate("default.config.json");
    expect(() => validateConfig(v)).not.toThrow();
  });

  it("default.config.json carries the spec-defined widget order", async () => {
    const cfg = (await loadTemplate("default.config.json")) as {
      lines: { widgets: { type: string; options?: { reset?: string } }[] }[];
      theme: string;
      powerline: { enabled: boolean };
    };
    const types = cfg.lines[0]!.widgets.map((w) => w.type);
    expect(types).toEqual([
      "model",
      "thinking-effort",
      "git-branch",
      "git-changes",
      "context-percentage",
      "tokens-total",
      "cost",
      "session-usage",
      "block-reset-timer",
      "flex-separator",
      "clock",
    ]);
    const tokens = cfg.lines[0]!.widgets.find((w) => w.type === "tokens-total");
    const cost = cfg.lines[0]!.widgets.find((w) => w.type === "cost");
    const session = cfg.lines[0]!.widgets.find((w) => w.type === "session-usage");
    expect(tokens?.options?.reset).toBe("block");
    expect(cost?.options?.reset).toBe("block");
    expect(session?.options?.reset).toBe("block");
    expect(cfg.theme).toBe("claude-code-dark");
    expect(cfg.powerline.enabled).toBe(false);
  });

  it("minimal.config.json validates against the schema", async () => {
    const v = await loadTemplate("minimal.config.json");
    expect(() => validateConfig(v)).not.toThrow();
  });

  it("minimal.config.json keeps a single line with at least one widget", async () => {
    const cfg = (await loadTemplate("minimal.config.json")) as {
      lines: { widgets: unknown[] }[];
    };
    expect(cfg.lines).toHaveLength(1);
    expect(cfg.lines[0]!.widgets.length).toBeGreaterThan(0);
  });

  it("both templates reference an installed theme", async () => {
    const themesDir = resolve(repoRoot, "themes");
    const installed = (await fs.readdir(themesDir))
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.replace(/\.json$/, ""));
    for (const name of ["default.config.json", "minimal.config.json"]) {
      const cfg = (await loadTemplate(name)) as { theme: string | null };
      if (cfg.theme) expect(installed).toContain(cfg.theme);
    }
  });
});
