import { describe, expect, it } from "vitest";

import { HelpRequestedError } from "../cli/help.js";
import { parseStartArgs } from "./command.js";

describe("parseStartArgs", () => {
  it("returns an empty accessibility set with no arguments", () => {
    const args = parseStartArgs([]);
    expect(args.accessibility).toBeDefined();
  });

  it("collects accessibility flags", () => {
    const args = parseStartArgs(["--no-color", "--ascii"]);
    expect(args.accessibility.noColor).toBe(true);
    expect(args.accessibility.noUnicode).toBe(true);
  });

  it("throws on unknown arguments", () => {
    expect(() => parseStartArgs(["--no-such-flag"])).toThrow(/unknown argument/);
  });

  it("requests help on -h", () => {
    expect(() => parseStartArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("requests help on --help", () => {
    expect(() => parseStartArgs(["--help"])).toThrow(HelpRequestedError);
  });
});
