import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigMutationError } from "../mutate.js";
import type { AgentlineConfig } from "../types.js";
import { parseWidgetReplaceArgs, runWidgetReplaceCommand } from "./replace.js";

describe("parseWidgetReplaceArgs", () => {
  it("requires a type and --at", () => {
    expect(() => parseWidgetReplaceArgs([])).toThrow(/replacement <type> is required/);
    expect(() => parseWidgetReplaceArgs(["clock"])).toThrow(/--at <index> is required/);
  });

  it("defaults line to 0", () => {
    expect(parseWidgetReplaceArgs(["clock", "--at", "1"])).toEqual({ type: "clock", line: 0, at: 1 });
  });

  it("reads --line, --at, and --options", () => {
    expect(parseWidgetReplaceArgs(["session-usage", "--line=1", "--at=0", "--options", '{"reset":"day"}'])).toEqual({
      type: "session-usage",
      line: 1,
      at: 0,
      options: { reset: "day" },
    });
  });

  it("rejects bad --options and prototype keys", () => {
    expect(() => parseWidgetReplaceArgs(["clock", "--at", "0", "--options", "x"])).toThrow(
      /not valid JSON/,
    );
    expect(() => parseWidgetReplaceArgs(["clock", "--at", "0", "--options", "[]"])).toThrow(
      /must be a JSON object/,
    );
    expect(() =>
      parseWidgetReplaceArgs(["clock", "--at", "0", "--options", '{"constructor":1}']),
    ).toThrow(/not allowed/);
  });

  it("rejects unknown options and extra positionals", () => {
    expect(() => parseWidgetReplaceArgs(["clock", "--at", "0", "--nope"])).toThrow(/unknown option/);
    expect(() => parseWidgetReplaceArgs(["clock", "extra", "--at", "0"])).toThrow(
      /unexpected argument/,
    );
  });
});

describe("runWidgetReplaceCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-widget-replace-"));
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

  it("swaps the widget and carries options through", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetReplaceCommand({
      args: { type: "session-usage", line: 0, at: 0, options: { reset: "block" } },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/replaced the widget/);
    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines[0]?.widgets).toEqual([
      { type: "session-usage", options: { reset: "block" } },
      { type: "clock" },
    ]);
  });

  it("propagates an unknown-type error and leaves the file untouched", async () => {
    const before = await fs.readFile(userCfg, "utf8");
    await expect(
      runWidgetReplaceCommand({
        args: { type: "made-up", line: 0, at: 0 },
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
      }),
    ).rejects.toBeInstanceOf(ConfigMutationError);
    expect(await fs.readFile(userCfg, "utf8")).toBe(before);
  });
});
