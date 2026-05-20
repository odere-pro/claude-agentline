import { describe, expect, it } from "vitest";

import { HELP_FLAGS, HelpRequestedError, isHelpFlag, requestHelp } from "./help.js";

describe("isHelpFlag", () => {
  it("matches -h and --help", () => {
    expect(isHelpFlag("-h")).toBe(true);
    expect(isHelpFlag("--help")).toBe(true);
  });

  it("does not match other flags or undefined", () => {
    expect(isHelpFlag(undefined)).toBe(false);
    expect(isHelpFlag("--config")).toBe(false);
    expect(isHelpFlag("")).toBe(false);
    expect(isHelpFlag("help")).toBe(false);
  });

  it("HELP_FLAGS exposes the canonical pair", () => {
    expect([...HELP_FLAGS].sort()).toEqual(["--help", "-h"]);
  });
});

describe("requestHelp", () => {
  it("throws HelpRequestedError carrying the body", () => {
    let caught: unknown = null;
    try {
      requestHelp("usage: foo");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HelpRequestedError);
    expect((caught as HelpRequestedError).body).toBe("usage: foo");
    expect((caught as Error).name).toBe("HelpRequestedError");
  });

  it("preserves an empty body", () => {
    expect(() => requestHelp("")).toThrow(HelpRequestedError);
  });
});
