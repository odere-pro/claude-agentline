import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigMutationError } from "../../mutate/mutate.js";
import type { AgentlineConfig } from "../../types.js";
import { parseWidgetSetOptionArgs, runWidgetSetOptionCommand } from "./set-option.js";

describe("parseWidgetSetOptionArgs", () => {
  it("requires <key> <value> and --at", () => {
    expect(() => parseWidgetSetOptionArgs(["--at", "0"])).toThrow(
      /<key> and a <value> are required/,
    );
    expect(() => parseWidgetSetOptionArgs(["k", "v"])).toThrow(/--at <index> is required/);
    expect(() => parseWidgetSetOptionArgs(["k", "v", "extra", "--at", "0"])).toThrow(
      /<key> and a <value> are required/,
    );
  });

  it("stores the value as a string by default", () => {
    expect(parseWidgetSetOptionArgs(["label", "hi", "--at", "0"])).toEqual({
      line: 0,
      at: 0,
      key: "label",
      value: "hi",
    });
  });

  it("parses the value as JSON with --json", () => {
    expect(parseWidgetSetOptionArgs(["count", "3", "--json", "--at", "1"])).toEqual({
      line: 0,
      at: 1,
      key: "count",
      value: 3,
    });
    expect(parseWidgetSetOptionArgs(["on", "true", "--json", "--at", "0"]).value).toBe(true);
  });

  it("rejects invalid JSON under --json and unknown options", () => {
    expect(() => parseWidgetSetOptionArgs(["k", "nope", "--json", "--at", "0"])).toThrow(
      /not valid JSON/,
    );
    expect(() => parseWidgetSetOptionArgs(["k", "v", "--at", "0", "--bogus"])).toThrow(
      /unknown option/,
    );
  });
});

describe("runWidgetSetOptionCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-widget-setopt-"));
    userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({
        version: 1,
        lines: [{ widgets: [{ type: "tokens", options: { reset: "block" } }] }],
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("merges the option into the widget and confirms on stdout", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runWidgetSetOptionCommand({
      args: { line: 0, at: 0, key: "format", value: "human" },
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/set option 'format'/);
    const onDisk = JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
    expect(onDisk.lines[0]?.widgets[0]?.options).toEqual({ reset: "block", format: "human" });
  });

  it("propagates a forbidden-key error and leaves the file untouched", async () => {
    const before = await fs.readFile(userCfg, "utf8");
    await expect(
      runWidgetSetOptionCommand({
        args: { line: 0, at: 0, key: "__proto__", value: {} },
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
      }),
    ).rejects.toBeInstanceOf(ConfigMutationError);
    expect(await fs.readFile(userCfg, "utf8")).toBe(before);
  });
});
