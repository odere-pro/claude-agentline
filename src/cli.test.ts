/**
 * CLI dispatch surface test.
 *
 * Locks the top-level command set: render / edit / reset / install /
 * uninstall / doctor / config + the help/version aliases.
 * `config` re-entered the surface in PR #107 to host scriptable
 * `config widget …` mutations for in-session use by the agentline
 * configure skill. `install` stays dispatched but is hidden from
 * `agentline help` — `reset` is the user/agent-facing entry point.
 */

import { describe, expect, it } from "vitest";

import { COMMANDS } from "./cli.js";

const EXPECTED_COMMANDS = [
  "render",
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
