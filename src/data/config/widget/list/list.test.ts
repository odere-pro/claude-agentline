import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "../../defaults/defaults.js";
import type { AgentlineConfig } from "../../types.js";
import { formatJson, formatText, parseWidgetListArgs, runWidgetListCommand } from "./list.js";

function cfg(lines: AgentlineConfig["lines"]): AgentlineConfig {
  return { ...DEFAULT_CONFIG, lines };
}

const sample = (): AgentlineConfig =>
  cfg([
    {
      widgets: [
        { type: "model" },
        { type: "tokens", options: { reset: "block" } },
        { type: "version", hidden: true },
      ],
    },
    { widgets: [] },
  ]);

describe("parseWidgetListArgs", () => {
  it("defaults to text output", () => {
    expect(parseWidgetListArgs([])).toEqual({ json: false });
  });

  it("--json enables JSON output", () => {
    expect(parseWidgetListArgs(["--json"])).toEqual({ json: true });
  });

  it("rejects unknown arguments", () => {
    expect(() => parseWidgetListArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("formatJson", () => {
  it("emits lines with per-widget index", () => {
    const parsed = JSON.parse(formatJson(sample())) as {
      lines: { line: number; widgets: { at: number; type: string }[] }[];
    };
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]?.widgets).toEqual([
      { at: 0, type: "model" },
      { at: 1, type: "tokens", options: { reset: "block" } },
      { at: 2, type: "version", hidden: true },
    ]);
    expect(parsed.lines[1]).toEqual({ line: 1, widgets: [] });
  });
});

describe("formatText", () => {
  it("lists each widget with index, flags, and options", () => {
    const text = formatText(sample());
    expect(text).toContain("line 0:");
    expect(text).toContain(" 0  model");
    expect(text).toContain('tokens {"reset":"block"}');
    expect(text).toContain("version [hidden]");
    expect(text).toContain("(empty)");
  });

  it("handles a config with no lines", () => {
    expect(formatText(cfg([]))).toContain("(no lines configured)");
  });
});

describe("runWidgetListCommand", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints JSON when --json is set", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetListCommand({ args: { json: true }, config: sample() });
    expect(code).toBe(0);
    const parsed = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "")) as { lines: unknown[] };
    expect(parsed.lines).toHaveLength(2);
  });

  it("prints text by default", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetListCommand({ args: { json: false }, config: sample() });
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toContain("agentline layout:");
  });
});
