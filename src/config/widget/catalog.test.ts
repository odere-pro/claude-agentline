import { afterEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetaEntry } from "../../widgets/index.js";
import {
  builtinMeta,
  formatJson,
  formatText,
  parseWidgetCatalogArgs,
  runWidgetCatalogCommand,
} from "./catalog.js";

const sample: readonly WidgetMetaEntry[] = [
  { type: "git-branch", name: "Git branch", description: "Current branch", family: "git" },
  { type: "model", name: "Model", description: "Active model id", family: "session" },
  { type: "clock", name: "Clock", description: "Wall-clock time", family: "time" },
];

describe("parseWidgetCatalogArgs", () => {
  it("defaults to text output", () => {
    expect(parseWidgetCatalogArgs([])).toEqual({ json: false });
  });

  it("--json sets the json flag", () => {
    expect(parseWidgetCatalogArgs(["--json"])).toEqual({ json: true });
  });

  it("rejects unknown arguments", () => {
    expect(() => parseWidgetCatalogArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("builtinMeta", () => {
  it("returns the catalogued built-in widgets with non-empty fields", () => {
    const entries = builtinMeta();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.type && e.name && e.description && e.family)).toBe(true);
  });
});

describe("formatJson", () => {
  it("emits a widgets array with type/name/description/family", () => {
    const parsed = JSON.parse(formatJson(sample)) as {
      widgets: { type: string; name: string; description: string; family: string }[];
    };
    expect(parsed.widgets).toEqual([
      { type: "git-branch", name: "Git branch", description: "Current branch", family: "git" },
      { type: "model", name: "Model", description: "Active model id", family: "session" },
      { type: "clock", name: "Clock", description: "Wall-clock time", family: "time" },
    ]);
  });
});

describe("formatText", () => {
  it("groups by family in family reading order", () => {
    const text = formatText(sample);
    expect(text).toContain("agentline widgets (3):");
    expect(text).toContain("session (1):");
    expect(text).toContain("git (1):");
    expect(text).toContain("clock");
    expect(text.indexOf("session (1):")).toBeLessThan(text.indexOf("git (1):"));
    expect(text.indexOf("git (1):")).toBeLessThan(text.indexOf("time (1):"));
  });
});

describe("runWidgetCatalogCommand", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints JSON when --json is set", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetCatalogCommand({
      args: { json: true },
      entries: sample,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "")) as { widgets: unknown[] };
    expect(parsed.widgets).toHaveLength(3);
  });

  it("falls back to the built-in registry when no entries are injected", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetCatalogCommand({ args: { json: false } });
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/agentline widgets \(\d+\):/);
  });
});
