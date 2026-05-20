import { describe, expect, it } from "vitest";

import { HelpRequestedError } from "../../core/lib/help/help.js";
import { parseDoctorArgs } from "./command.js";

describe("parseDoctorArgs", () => {
  it("returns all-false defaults for an empty argv", () => {
    expect(parseDoctorArgs([])).toEqual({ fix: false, json: false, strict: false });
  });

  it("recognises --fix", () => {
    expect(parseDoctorArgs(["--fix"]).fix).toBe(true);
  });

  it("recognises --json", () => {
    expect(parseDoctorArgs(["--json"]).json).toBe(true);
  });

  it("recognises --strict", () => {
    expect(parseDoctorArgs(["--strict"]).strict).toBe(true);
  });

  it("composes flags in any order", () => {
    expect(parseDoctorArgs(["--strict", "--json", "--fix"])).toEqual({
      fix: true,
      json: true,
      strict: true,
    });
  });

  it("throws HelpRequestedError on -h", () => {
    expect(() => parseDoctorArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("throws HelpRequestedError on --help", () => {
    expect(() => parseDoctorArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("rejects an unknown argument", () => {
    expect(() => parseDoctorArgs(["--what"])).toThrow(/unknown argument '--what'/);
  });
});
