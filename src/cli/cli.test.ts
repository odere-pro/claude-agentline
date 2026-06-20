/**
 * CLI dispatch surface test.
 *
 * Locks the top-level command set: render / start / edit / reset /
 * install / uninstall / doctor / config + the help/version aliases.
 * `config` re-entered the surface in PR #107 to host scriptable
 * `config widget …` mutations for in-session use by the agentline
 * configure skill. `install` stays dispatched but is hidden from
 * `agentline help` — `reset` is the user/agent-facing entry point.
 *
 * `__refresh-claude-health` was removed: doctor D10 now refreshes the
 * cache inline; the hidden verb and the render-path spawn are gone.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { COMMANDS } from "./cli.js";

const EXPECTED_COMMANDS = [
  "render",
  "start",
  "edit",
  "reset",
  "install",
  "uninstall",
  "doctor",
  "config",
  "help",
  "--help",
  "-h",
  "version",
  "--version",
  "-v",
] as const;

const DROPPED_COMMANDS = ["theme", "themes", "widget", "schema", "init", "keys"] as const;

describe("CLI dispatch table", () => {
  it("exposes every flat command", () => {
    for (const cmd of EXPECTED_COMMANDS) {
      expect(COMMANDS[cmd]).toBeTypeOf("function");
    }
  });

  it("keeps `install` dispatched even though it is hidden from help", () => {
    /*
     * `reset` is the advertised entry point, but npm/postinstall, the
     * `--from-source` dev flow, and existing scripts still call
     * `agentline install`. Removing it would be a silent compat break,
     * so this lock is intentional — do not delete the install entry.
     */
    expect(COMMANDS.install).toBeTypeOf("function");
  });

  it("does not expose dropped subgroup commands", () => {
    for (const cmd of DROPPED_COMMANDS) {
      expect(COMMANDS[cmd]).toBeUndefined();
    }
  });

  it("exposes exactly the documented surface (no surprise entries)", () => {
    expect(Object.keys(COMMANDS).sort()).toEqual([...EXPECTED_COMMANDS].sort());
  });
});

describe("COMMANDS.edit --help", () => {
  let stdoutChunks: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    stdoutChunks = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    // Capture stdout without calling the real write so nothing leaks to the terminal.
    process.stdout.write = ((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it("resolves 0 when passed --help", async () => {
    const code = await COMMANDS.edit!(["--help"]);
    expect(code).toBe(0);
  });

  it("resolves 0 when passed -h", async () => {
    const code = await COMMANDS.edit!(["-h"]);
    expect(code).toBe(0);
  });

  it("writes help text to stdout for --help", async () => {
    await COMMANDS.edit!(["--help"]);
    const output = stdoutChunks.join("");
    expect(output).toContain("agentline edit");
    expect(output).toContain("TUI editor");
  });

  it("does not invoke the TUI on --help (gate-19 safe: no dynamic import attempted)", async () => {
    // We verify no dynamic import of tui.mjs is triggered by checking that
    // the command resolves immediately without the editor module being loaded.
    // Because tui.mjs does not exist in test contexts, any attempt to import
    // it would throw; the fact the test passes proves the help path is clean.
    const code = await COMMANDS.edit!(["--help"]);
    expect(code).toBe(0);
  });
});
