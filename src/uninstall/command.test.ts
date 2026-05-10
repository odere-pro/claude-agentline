import { describe, expect, it } from "vitest";

import { HelpRequestedError } from "../cli/help.js";
import { parseUninstallArgs } from "./command.js";

describe("parseUninstallArgs", () => {
  it("returns all false with no arguments", () => {
    expect(parseUninstallArgs([])).toEqual({ purge: false, dryRun: false });
  });

  it("sets purge when --purge is passed", () => {
    const args = parseUninstallArgs(["--purge"]);
    expect(args.purge).toBe(true);
    expect(args.dryRun).toBe(false);
  });

  it("sets dryRun when --dry-run is passed", () => {
    const args = parseUninstallArgs(["--dry-run"]);
    expect(args.dryRun).toBe(true);
    expect(args.purge).toBe(false);
  });

  it("sets both flags together", () => {
    const args = parseUninstallArgs(["--purge", "--dry-run"]);
    expect(args).toEqual({ purge: true, dryRun: true });
  });

  it("throws HelpRequestedError for -h", () => {
    expect(() => parseUninstallArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("throws HelpRequestedError for --help", () => {
    expect(() => parseUninstallArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("throws Error with 'unknown argument' for unrecognised flag", () => {
    expect(() => parseUninstallArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("throws Error with the unknown flag name in the message", () => {
    expect(() => parseUninstallArgs(["--unknown-flag"])).toThrow(/unknown-flag/);
  });
});
