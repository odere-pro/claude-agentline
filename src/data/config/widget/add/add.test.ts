import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigMutationError } from "../../mutate/mutate.js";
import type { AgentlineConfig } from "../../types.js";
import { parseWidgetAddArgs, runWidgetAddCommand } from "./add.js";

describe("parseWidgetAddArgs", () => {
  it("requires a type", () => {
    expect(() => parseWidgetAddArgs([])).toThrow(/<type> is required/);
  });

  it("defaults line to 0 and leaves at/options unset", () => {
    expect(parseWidgetAddArgs(["version"])).toEqual({ type: "version", line: 0 });
  });

  it("reads --line and --at as space- or =-separated integers", () => {
    expect(parseWidgetAddArgs(["version", "--line", "1", "--at", "2"])).toEqual({
      type: "version",
      line: 1,
      at: 2,
    });
    expect(parseWidgetAddArgs(["version", "--line=2", "--at=0"])).toEqual({
      type: "version",
      line: 2,
      at: 0,
    });
  });

  it("parses --options into an object", () => {
    expect(parseWidgetAddArgs(["session-weekly-usage", "--options", '{"reset":"block"}'])).toEqual(
      {
        type: "session-weekly-usage",
        line: 0,
        options: { reset: "block" },
      },
    );
  });

  it("rejects non-integer --line / --at", () => {
    expect(() => parseWidgetAddArgs(["version", "--line", "x"])).toThrow(/must be an integer/);
  });

  it("rejects invalid or non-object --options", () => {
    expect(() => parseWidgetAddArgs(["version", "--options", "nope"])).toThrow(/not valid JSON/);
    expect(() => parseWidgetAddArgs(["version", "--options", "[1,2]"])).toThrow(
      /must be a JSON object/,
    );
  });

  it("rejects prototype-polluting option keys", () => {
    expect(() => parseWidgetAddArgs(["version", "--options", '{"__proto__":{}}'])).toThrow(
      /not allowed/,
    );
  });

  it("rejects unknown options and extra positionals", () => {
    expect(() => parseWidgetAddArgs(["version", "--nope"])).toThrow(/unknown option/);
    expect(() => parseWidgetAddArgs(["version", "extra"])).toThrow(/unexpected argument/);
  });
});

describe("runWidgetAddCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-widget-add-"));
    userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({ version: 1, lines: [{ widgets: [{ type: "model" }] }] }),
    );
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function onDisk(): Promise<AgentlineConfig> {
    return JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
  }

  it("appends a widget and confirms on stdout", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetAddCommand({
      args: { type: "git-branch", line: 0 },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/added 'git-branch'/);
    expect((await onDisk()).lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "git-branch"]);
  });

  it("inserts at an index and carries options through", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetAddCommand({
      args: { type: "session-weekly-usage", line: 0, at: 0, options: { label: "wk:" } },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    const widgets = (await onDisk()).lines[0]?.widgets;
    expect(widgets?.[0]).toEqual({ type: "session-weekly-usage", options: { label: "wk:" } });
    expect(widgets?.[1]?.type).toBe("model");
  });

  it("propagates a mutation error and leaves the file untouched", async () => {
    const before = await fs.readFile(userCfg, "utf8");
    await expect(
      runWidgetAddCommand({
        args: { type: "made-up", line: 0 },
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
      }),
    ).rejects.toBeInstanceOf(ConfigMutationError);
    expect(await fs.readFile(userCfg, "utf8")).toBe(before);
  });
});
