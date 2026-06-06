import { afterEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetaEntry } from "../../../../widgets/index.js";
import type { WidgetVariant } from "../../../../widgets/families/catalog-types.js";
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
  {
    type: "context-percentage",
    name: "Context %",
    description: "Context window used",
    family: "context",
  },
];

const sampleWithVariants: readonly WidgetMetaEntry[] = [
  { type: "git-branch", name: "Git branch", description: "Current branch", family: "git" },
  {
    type: "git-pr",
    name: "Git pull request",
    description: "PR for HEAD branch",
    family: "git",
    variants: [
      { id: "number", label: "Number (#42)", options: { variant: "number" } },
      { id: "url", label: "URL (https://…)", options: { variant: "url" } },
    ] as readonly WidgetVariant[],
  },
  {
    type: "account-email",
    name: "Account email",
    description: "Logged-in account email",
    family: "session",
    variants: [
      { id: "full", label: "Full address", options: { mask: "none" } },
      { id: "domain", label: "Domain only", options: { mask: "domain" } },
    ] as readonly WidgetVariant[],
  },
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

// ── formatJson — original contract preserved ─────────────────────────────────

describe("formatJson — without variants", () => {
  it("emits a widgets array with type/name/description/family", () => {
    const parsed = JSON.parse(formatJson(sample)) as {
      widgets: { type: string; name: string; description: string; family: string }[];
    };
    expect(parsed.widgets).toEqual([
      { type: "git-branch", name: "Git branch", description: "Current branch", family: "git" },
      { type: "model", name: "Model", description: "Active model id", family: "session" },
      {
        type: "context-percentage",
        name: "Context %",
        description: "Context window used",
        family: "context",
      },
    ]);
  });
});

// ── formatJson — variants surface ────────────────────────────────────────────

describe("formatJson — with variants", () => {
  it("includes variants array when present", () => {
    const parsed = JSON.parse(formatJson(sampleWithVariants)) as {
      widgets: {
        type: string;
        variants?: { id: string; label: string; options: Record<string, unknown> }[];
      }[];
    };

    // git-branch has no variants → field absent
    const branch = parsed.widgets.find((w) => w.type === "git-branch")!;
    expect(branch.variants).toBeUndefined();

    // git-pr has 2 variants
    const pr = parsed.widgets.find((w) => w.type === "git-pr")!;
    expect(pr.variants).toHaveLength(2);
    expect(pr.variants![0]).toEqual({
      id: "number",
      label: "Number (#42)",
      options: { variant: "number" },
    });

    // account-email has 2 variants
    const email = parsed.widgets.find((w) => w.type === "account-email")!;
    expect(email.variants).toHaveLength(2);
    expect(email.variants![1]).toEqual({
      id: "domain",
      label: "Domain only",
      options: { mask: "domain" },
    });
  });

  it("built-in entries surface variants in JSON output for types that have them", () => {
    const entries = builtinMeta();
    const parsed = JSON.parse(formatJson(entries)) as {
      widgets: { type: string; variants?: unknown[] }[];
    };
    // git-pr has variants in the catalogue
    const pr = parsed.widgets.find((w) => w.type === "git-pr");
    expect(pr).toBeDefined();
    expect(pr!.variants).toBeDefined();
    expect(Array.isArray(pr!.variants)).toBe(true);
    expect((pr!.variants as unknown[]).length).toBeGreaterThan(0);
  });
});

// ── formatText — variants surface ────────────────────────────────────────────

describe("formatText — with variants", () => {
  it("groups by family in family reading order (no-variants entries unchanged)", () => {
    const text = formatText(sample);
    expect(text).toContain("agentline widgets (3):");
    expect(text).toContain("session (1):");
    expect(text).toContain("context (1):");
    expect(text).toContain("git (1):");
    expect(text).toContain("context-percentage");
    expect(text.indexOf("session (1):")).toBeLessThan(text.indexOf("context (1):"));
    expect(text.indexOf("context (1):")).toBeLessThan(text.indexOf("git (1):"));
  });

  it("shows variant ids inline for widgets that have variants", () => {
    const text = formatText(sampleWithVariants);
    // Should show variant ids for git-pr
    expect(text).toContain("number");
    expect(text).toContain("url");
    // Should show variant ids for account-email
    expect(text).toContain("full");
    expect(text).toContain("domain");
  });

  it("does not show a variants line for widgets without variants", () => {
    const text = formatText(sample);
    // sample has no variants entries — no "variants:" prefix expected
    expect(text).not.toContain("variants:");
  });
});

// ── runWidgetCatalogCommand ───────────────────────────────────────────────────

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

  it("JSON output includes variants for built-in widgets that have them", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetCatalogCommand({ args: { json: true }, entries: sampleWithVariants });
    const parsed = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "")) as {
      widgets: { type: string; variants?: unknown[] }[];
    };
    const pr = parsed.widgets.find((w) => w.type === "git-pr");
    expect(pr?.variants).toBeDefined();
    expect(Array.isArray(pr?.variants)).toBe(true);
  });
});
