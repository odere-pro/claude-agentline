/**
 * Round-trip tests for the shipped default template
 * (`templates/default.config.json`).
 *
 * The template is the source of truth for what `scripts/install.sh`
 * (and the `agentline install` CLI) writes to a fresh user config
 * dir. The tests
 * assert that:
 *
 *   1. It parses as JSON.
 *   2. It validates against the embedded JSON Schema.
 *   3. The first line matches the §7.10 widget set, with
 *      `tokens-total` / `session-usage` declaring `reset: block`
 *      and the theme set to `claude-code-dark`.
 *
 * Failing here means the template and the schema have drifted apart;
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

describe("shipped config template", () => {
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
      "session-usage",
      "block-reset-timer",
      "clock",
    ]);
    const tokens = cfg.lines[0]!.widgets.find((w) => w.type === "tokens-total");
    const session = cfg.lines[0]!.widgets.find((w) => w.type === "session-usage");
    expect(tokens?.options?.reset).toBe("block");
    expect(session?.options?.reset).toBe("block");
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
});
