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
 *   3. The three lines match the shipped default layout, with
 *      `tokens` declaring `reset: block` and the theme set
 *      to `claude-code-dark`.
 *
 * Failing here means the template and the schema have drifted apart;
 * fix the offender before shipping.
 */

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateConfig } from "./validate/validate.js";

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

  it("default.config.json carries the shipped three-line widget layout", async () => {
    const cfg = (await loadTemplate("default.config.json")) as {
      lines: { widgets: { type: string; options?: { reset?: string } }[] }[];
      theme: string;
      powerline: { enabled: boolean };
    };
    const layout = cfg.lines.map((l) => l.widgets.map((w) => w.type));
    expect(layout).toEqual([
      ["model", "thinking-effort", "git-branch", "git-changes"],
      ["context-percentage", "context-bar", "tokens"],
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
});
