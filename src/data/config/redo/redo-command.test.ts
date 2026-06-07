/**
 * TDD tests for `agentline config redo`.
 *
 * Rolls forward to the config that `config undo` last rolled back from
 * (the forward slot, `config.json.redo`). All filesystem operations are
 * scoped to a temp dir injected via `CLAUDE_CONFIG_DIR` — never the real
 * config dir.
 *
 * Key behaviours: a full mutate → undo → redo cycle returns the post-edit
 * config; "nothing to redo" exits non-zero with a clear message and does
 * not crash; a new mutation after an undo invalidates the redo (you can't
 * redo a diverged branch); `--help` prints help and does not act.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HelpRequestedError } from "../../../core/lib/help/help.js";
import { saveAddWidget } from "../mutate/mutate.js";
import { runUndoCommand } from "../undo/undo-command.js";
import type { AgentlineConfig } from "../types.js";
import { parseRedoArgs, runRedoCommand } from "./redo-command.js";

async function makeSandbox(): Promise<{ claudeCfgDir: string; userCfg: string }> {
  const claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-redo-test-"));
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

describe("parseRedoArgs", () => {
  it("accepts no arguments", () => {
    expect(parseRedoArgs([])).toEqual({});
  });

  it("requests help for -h / --help (does not act)", () => {
    expect(() => parseRedoArgs(["--help"])).toThrow(HelpRequestedError);
    expect(() => parseRedoArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("rejects unknown flags", () => {
    expect(() => parseRedoArgs(["--bogus"])).toThrow(/unknown/i);
  });

  it("rejects unexpected positionals", () => {
    expect(() => parseRedoArgs(["extra"])).toThrow(/unexpected/i);
  });
});

describe("runRedoCommand", () => {
  let claudeCfgDir: string;
  let userCfg: string;
  const env = () => ({ CLAUDE_CONFIG_DIR: claudeCfgDir });

  beforeEach(async () => {
    ({ claudeCfgDir, userCfg } = await makeSandbox());
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("exits non-zero with a clear message when there is nothing to redo", async () => {
    await seedConfig(userCfg, BASE);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRedoCommand({ args: {}, env: env() });
    expect(code).not.toBe(0);
    expect(String(stderr.mock.calls[0]?.[0] ?? "")).toMatch(/nothing to redo|no .* redo/i);
    expect(await readConfig(userCfg)).toEqual(BASE);
  });

  it("rolls forward after a mutate → undo (full cycle)", async () => {
    await seedConfig(userCfg, BASE);
    await saveAddWidget({ line: 0, widget: { type: "version" } }, { env: env() });
    // current = [model, version]; undo → [model], redo slot = [model, version]
    await runUndoCommand({ args: {}, env: env() });
    expect((await readConfig(userCfg)).lines[0]?.widgets.map((w) => w.type)).toEqual(["model"]);

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runRedoCommand({ args: {}, env: env() });
    expect(code).toBe(0);
    expect(String(stdout.mock.calls[0]?.[0] ?? "")).toMatch(/redo|rolled forward|reapplied/i);
    expect((await readConfig(userCfg)).lines[0]?.widgets.map((w) => w.type)).toEqual([
      "model",
      "version",
    ]);
  });

  it("a new mutation after an undo invalidates the redo (diverged branch)", async () => {
    await seedConfig(userCfg, BASE);
    await saveAddWidget({ line: 0, widget: { type: "version" } }, { env: env() });
    await runUndoCommand({ args: {}, env: env() }); // current = [model], redo = [model, version]
    // Diverge: a new mutation must drop the redo slot.
    await saveAddWidget({ line: 0, widget: { type: "plan" } }, { env: env() });

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runRedoCommand({ args: {}, env: env() });
    expect(code).not.toBe(0);
    expect(String(stderr.mock.calls[0]?.[0] ?? "")).toMatch(/nothing to redo/i);
    // The diverged config is untouched.
    expect((await readConfig(userCfg)).lines[0]?.widgets.map((w) => w.type)).toEqual([
      "model",
      "plan",
    ]);
  });

  it("undo → redo → undo round-trips", async () => {
    await seedConfig(userCfg, BASE);
    await saveAddWidget({ line: 0, widget: { type: "version" } }, { env: env() });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runUndoCommand({ args: {}, env: env() });
    expect((await readConfig(userCfg)).lines[0]?.widgets.map((w) => w.type)).toEqual(["model"]);
    await runRedoCommand({ args: {}, env: env() });
    expect((await readConfig(userCfg)).lines[0]?.widgets.map((w) => w.type)).toEqual([
      "model",
      "version",
    ]);
    await runUndoCommand({ args: {}, env: env() });
    expect((await readConfig(userCfg)).lines[0]?.widgets.map((w) => w.type)).toEqual(["model"]);
  });
});
