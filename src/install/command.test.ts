import { describe, expect, it } from "vitest";

import { HelpRequestedError } from "../cli/help.js";
import { parseInstallArgs } from "./command.js";

describe("parseInstallArgs", () => {
  it("returns all false with no arguments", () => {
    expect(parseInstallArgs([])).toEqual({ fromSource: false, force: false, dryRun: false });
  });

  it("sets fromSource when --from-source is passed", () => {
    const args = parseInstallArgs(["--from-source"]);
    expect(args.fromSource).toBe(true);
    expect(args.force).toBe(false);
    expect(args.dryRun).toBe(false);
  });

  it("sets force when --force is passed", () => {
    const args = parseInstallArgs(["--force"]);
    expect(args.force).toBe(true);
    expect(args.fromSource).toBe(false);
    expect(args.dryRun).toBe(false);
  });

  it("sets dryRun when --dry-run is passed", () => {
    const args = parseInstallArgs(["--dry-run"]);
    expect(args.dryRun).toBe(true);
    expect(args.fromSource).toBe(false);
    expect(args.force).toBe(false);
  });

  it("sets all three flags together", () => {
    const args = parseInstallArgs(["--from-source", "--force", "--dry-run"]);
    expect(args).toEqual({ fromSource: true, force: true, dryRun: true });
  });

  it("throws HelpRequestedError for -h", () => {
    expect(() => parseInstallArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("throws HelpRequestedError for --help", () => {
    expect(() => parseInstallArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("throws Error with 'unknown argument' for unrecognised flag", () => {
    expect(() => parseInstallArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("throws Error with the unknown flag name in the message", () => {
    expect(() => parseInstallArgs(["--unknown-flag"])).toThrow(/unknown-flag/);
  });
});
