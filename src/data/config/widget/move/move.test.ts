import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigMutationError } from "../../mutate/mutate.js";
import type { AgentlineConfig } from "../../types.js";
import { parseWidgetMoveArgs, runWidgetMoveCommand } from "./move.js";

describe("parseWidgetMoveArgs", () => {
  it("requires --from-at", () => {
    expect(() => parseWidgetMoveArgs([])).toThrow(/--from-at <index> is required/);
    expect(() => parseWidgetMoveArgs(["--to-at", "0"])).toThrow(/--from-at <index> is required/);
  });

  it("defaults from-line to 0 and to-line to from-line; leaves to-at unset", () => {
    expect(parseWidgetMoveArgs(["--from-at", "2"])).toEqual({ fromLine: 0, fromAt: 2, toLine: 0 });
    expect(parseWidgetMoveArgs(["--from-line", "1", "--from-at", "0"])).toEqual({
      fromLine: 1,
      fromAt: 0,
      toLine: 1,
    });
  });

  it("reads every flag, space- or =-separated", () => {
    expect(
      parseWidgetMoveArgs(["--from-line=0", "--from-at=1", "--to-line=2", "--to-at=0"]),
    ).toEqual({ fromLine: 0, fromAt: 1, toLine: 2, toAt: 0 });
  });

  it("rejects non-integer values and stray arguments", () => {
    expect(() => parseWidgetMoveArgs(["--from-at", "x"])).toThrow(/must be an integer/);
    expect(() => parseWidgetMoveArgs(["--from-at", "0", "junk"])).toThrow(/unexpected argument/);
  });
});

describe("runWidgetMoveCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-widget-move-"));
    userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({
        version: 1,
        lines: [{ widgets: [{ type: "model" }, { type: "git-branch" }, { type: "version" }] }],
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("reorders within a line and confirms on stdout", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetMoveCommand({
      args: { fromLine: 0, fromAt: 2, toLine: 0, toAt: 0 },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/moved the widget/);
    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines[0]?.widgets.map((w) => w.type)).toEqual(["version", "model", "git-branch"]);
  });

  it("moves a widget to a padded line", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runWidgetMoveCommand({
      args: { fromLine: 0, fromAt: 0, toLine: 2 },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines).toHaveLength(3);
    expect(onDisk.lines[2]?.widgets.map((w) => w.type)).toEqual(["model"]);
  });

  it("propagates an out-of-range error and leaves the file untouched", async () => {
    const before = await fs.readFile(userCfg, "utf8");
    await expect(
      runWidgetMoveCommand({
        args: { fromLine: 0, fromAt: 9, toLine: 0 },
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
      }),
    ).rejects.toBeInstanceOf(ConfigMutationError);
    expect(await fs.readFile(userCfg, "utf8")).toBe(before);
  });
});
