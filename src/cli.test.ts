/**
 * CLI dispatch surface test.
 *
 * Locks the flat top-level command set (§9.1, Phase 1 CLI flatten):
 * render / edit / init / keys / install / uninstall / doctor + the
 * help/version aliases. Dropped commands (`config`, `theme`, `widget`,
 * `schema`) MUST be absent so the dispatch table stays the source of
 * truth for "is this a known command?".
 */

import { describe, expect, it } from "vitest";

import { COMMANDS } from "./cli.js";

const EXPECTED_COMMANDS = [
  "render",
  "edit",
  "init",
  "keys",
  "install",
  "uninstall",
  "doctor",
  "help",
  "--help",
  "-h",
  "version",
  "--version",
  "-v",
] as const;

const DROPPED_COMMANDS = ["config", "theme", "themes", "widget", "schema"] as const;

describe("CLI dispatch table", () => {
  it("exposes every flat command", () => {
    for (const cmd of EXPECTED_COMMANDS) {
      expect(COMMANDS[cmd]).toBeTypeOf("function");
    }
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
