/**
 * TDD tests for `agentline config undo`.
 *
 * Restores the single-slot config backup (`config.json.bak`) written by
 * every config-writing path. All filesystem operations are scoped to a
 * temp dir injected via `CLAUDE_CONFIG_DIR` — never the real config dir.
 *
 * The key behaviours: a full mutate → undo round-trip restores the prior
 * config; "no backup yet" exits non-zero with a clear message and does
 * not crash; `--help` prints help and does not act.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HelpRequestedError } from "../../../core/lib/help/help.js";
import { saveAddWidget } from "../mutate/mutate.js";
import type { AgentlineConfig } from "../types.js";
import { parseUndoArgs, runUndoCommand } from "./undo-command.js";

async function makeSandbox(): Promise<{ claudeCfgDir: string; userCfg: string }> {
  const claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-undo-test-"));
  const userCfg = join(claudeCfgDir, "agentline", "config.json");
  await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
  return { claudeCfgDir, userCfg };
}

async function seedConfig(userCfg: string, cfg: AgentlineConfig): Promise<void> {
  await fs.writeFile(userCfg, `${JSON.stringify(cfg, null, 2)}\n`);
}

async function readConfig(userCfg: string): Promise<AgentlineConfig> {
  return JSON.parse(await fs.readFile(userCfg, "utf8")) as AgentlineConfig;
}

const BASE: AgentlineConfig = {
  version: 1,
  lines: [{ widgets: [{ type: "model" }] }],
} as AgentlineConfig;

describe("parseUndoArgs", () => {
  it("accepts no arguments", () => {
    expect(parseUndoArgs([])).toEqual({});
  });

  it("requests help for -h / --help (does not act)", () => {
    expect(() => parseUndoArgs(["--help"])).toThrow(HelpRequestedError);
    expect(() => parseUndoArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("rejects unknown flags", () => {
    expect(() => parseUndoArgs(["--bogus"])).toThrow(/unknown/i);
  });

  it("rejects unexpected positionals", () => {
    expect(() => parseUndoArgs(["extra"])).toThrow(/unexpected/i);
  });
});

describe("runUndoCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;

  beforeEach(async () => {
    ({ claudeCfgDir, userCfg } = await makeSandbox());
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("exits non-zero with a clear message when there is no backup", async () => {
    await seedConfig(userCfg, BASE);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runUndoCommand({ args: {}, env: { CLAUDE_CONFIG_DIR: claudeCfgDir } });
    expect(code).not.toBe(0);
    expect(String(stderr.mock.calls[0]?.[0] ?? "")).toMatch(/nothing to undo|no backup/i);
    // Config untouched
    expect(await readConfig(userCfg)).toEqual(BASE);
  });

  it("restores the prior config after a widget add (full round-trip)", async () => {
    await seedConfig(userCfg, BASE);
    // A mutation writes the new config AND backs up BASE to config.json.bak.
    await saveAddWidget(
      { line: 0, widget: { type: "version" } },
      { env: { CLAUDE_CONFIG_DIR: claudeCfgDir } },
    );
    const afterAdd = await readConfig(userCfg);
    expect(afterAdd.lines[0]?.widgets.map((w) => w.type)).toEqual(["model", "version"]);

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runUndoCommand({ args: {}, env: { CLAUDE_CONFIG_DIR: claudeCfgDir } });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/restored/i);

    // Config is back to BASE (the widget add is undone).
    const afterUndo = await readConfig(userCfg);
    expect(afterUndo.lines[0]?.widgets.map((w) => w.type)).toEqual(["model"]);
  });

  it("prints the restored config path in the confirmation line", async () => {
    await seedConfig(userCfg, BASE);
    await saveAddWidget(
      { line: 0, widget: { type: "version" } },
      { env: { CLAUDE_CONFIG_DIR: claudeCfgDir } },
    );
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runUndoCommand({ args: {}, env: { CLAUDE_CONFIG_DIR: claudeCfgDir } });
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toContain(userCfg);
  });
});
