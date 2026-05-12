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
  { type: "git-branch", name: "Git branch", description: "Current branch", category: "git" },
  { type: "model", name: "Model", description: "Active model id", category: "session" },
  { type: "clock", name: "Clock", description: "Wall-clock time", category: "time" },
];

describe("parseWidgetCatalogArgs", () => {
  it("defaults to text output without previews", () => {
    expect(parseWidgetCatalogArgs([])).toEqual({ json: false, preview: false });
  });

  it("--json and --preview set their flags", () => {
    expect(parseWidgetCatalogArgs(["--json"])).toEqual({ json: true, preview: false });
    expect(parseWidgetCatalogArgs(["--preview"])).toEqual({ json: false, preview: true });
    expect(parseWidgetCatalogArgs(["--json", "--preview"])).toEqual({ json: true, preview: true });
  });

  it("rejects unknown arguments", () => {
    expect(() => parseWidgetCatalogArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("builtinMeta", () => {
  it("returns the 53 catalogued built-in widgets", () => {
    const entries = builtinMeta();
    expect(entries).toHaveLength(53);
    expect(entries.every((e) => e.type && e.name && e.description && e.category)).toBe(true);
  });
});

describe("formatJson", () => {
  it("emits a widgets array with type/name/description/category", () => {
    const parsed = JSON.parse(formatJson(sample)) as {
      widgets: { type: string; name: string; description: string; category: string }[];
    };
    expect(parsed.widgets).toEqual([
      { type: "git-branch", name: "Git branch", description: "Current branch", category: "git" },
      { type: "model", name: "Model", description: "Active model id", category: "session" },
      { type: "clock", name: "Clock", description: "Wall-clock time", category: "time" },
    ]);
  });

  it("adds a string `preview` field per widget when --preview is set", () => {
    const parsed = JSON.parse(formatJson(builtinMeta(), { preview: true })) as {
      widgets: { type: string; preview: string }[];
    };
    expect(parsed.widgets.every((w) => typeof w.preview === "string")).toBe(true);
    const branch = parsed.widgets.find((w) => w.type === "git-branch");
    expect(branch?.preview).toContain("main");
  });
});

describe("formatText", () => {
  it("groups by category in family reading order", () => {
    const text = formatText(sample);
    expect(text).toContain("agentline widgets (3):");
    expect(text).toContain("session (1):");
    expect(text).toContain("git (1):");
    expect(text).toContain("clock");
    expect(text.indexOf("session (1):")).toBeLessThan(text.indexOf("git (1):"));
    expect(text.indexOf("git (1):")).toBeLessThan(text.indexOf("time (1):"));
  });

  it("appends a preview column when --preview is set", () => {
    const text = formatText(builtinMeta(), { preview: true });
    expect(text).toMatch(/git-branch\s+Current branch[^\n]*→\s+main/);
  });
});

describe("runWidgetCatalogCommand", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints JSON when --json is set", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetCatalogCommand({
      args: { json: true, preview: false },
      entries: sample,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "")) as { widgets: unknown[] };
    expect(parsed.widgets).toHaveLength(3);
  });

  it("falls back to the built-in registry when no entries are injected", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetCatalogCommand({ args: { json: false, preview: false } });
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toContain("agentline widgets (53):");
  });

  it("includes previews with --preview", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetCatalogCommand({ args: { json: true, preview: true } });
    const parsed = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "")) as {
      widgets: { type: string; preview?: string }[];
    };
    expect(parsed.widgets.find((w) => w.type === "model")?.preview).toBeDefined();
  });
});
