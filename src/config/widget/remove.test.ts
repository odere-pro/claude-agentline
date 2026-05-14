import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigMutationError } from "../mutate.js";
import type { AgentlineConfig } from "../types.js";
import { parseWidgetRemoveArgs, runWidgetRemoveCommand } from "./remove.js";

describe("parseWidgetRemoveArgs", () => {
  it("requires --at", () => {
    expect(() => parseWidgetRemoveArgs([])).toThrow(/--at <index> is required/);
    expect(() => parseWidgetRemoveArgs(["--line", "0"])).toThrow(/--at <index> is required/);
  });

  it("defaults line to 0", () => {
    expect(parseWidgetRemoveArgs(["--at", "1"])).toEqual({ line: 0, at: 1 });
  });

  it("reads --line and --at, space- or =-separated", () => {
    expect(parseWidgetRemoveArgs(["--line", "2", "--at", "0"])).toEqual({ line: 2, at: 0 });
    expect(parseWidgetRemoveArgs(["--line=1", "--at=3"])).toEqual({ line: 1, at: 3 });
  });

  it("rejects non-integer values and stray arguments", () => {
    expect(() => parseWidgetRemoveArgs(["--at", "x"])).toThrow(/must be an integer/);
    expect(() => parseWidgetRemoveArgs(["--at", "0", "extra"])).toThrow(/unexpected argument/);
  });
});

describe("runWidgetRemoveCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-widget-remove-"));
    userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({ version: 1, lines: [{ widgets: [{ type: "model" }, { type: "clock" }] }] }),
    );
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("drops the widget at the index and confirms on stdout", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetRemoveCommand({
      args: { line: 0, at: 0 },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/removed the widget at line 0, index 0/);
    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines[0]?.widgets.map((w) => w.type)).toEqual(["clock"]);
  });

  it("propagates an out-of-range error and leaves the file untouched", async () => {
    const before = await fs.readFile(userCfg, "utf8");
    await expect(
      runWidgetRemoveCommand({ args: { line: 0, at: 9 }, env: { CLAUDE_CONFIG_DIR: claudeCfgDir } }),
    ).rejects.toBeInstanceOf(ConfigMutationError);
    expect(await fs.readFile(userCfg, "utf8")).toBe(before);
  });
});
