/**
 * `parseRefreshArgs` argument-validation contract.
 *
 * `runRefreshCommand` is exercised through the install + doctor
 * integration suites (it composes pure mutators with the same
 * atomic-write path those suites already cover); the parse layer is
 * what we pin here, since wrong parsing surfaces to the user as a CLI
 * error and any drift would not be caught by integration tests.
 */
import { describe, expect, it } from "vitest";

import { HelpRequestedError } from "../../../core/lib/help/help.js";

import { parseRefreshArgs } from "./refresh-command.js";

describe("parseRefreshArgs", () => {
  it("returns an empty record when no positional argument is given (print mode)", () => {
    expect(parseRefreshArgs([])).toEqual({});
  });

  it("parses a non-negative integer into `seconds`", () => {
    expect(parseRefreshArgs(["0"])).toEqual({ seconds: 0 });
    expect(parseRefreshArgs(["1"])).toEqual({ seconds: 1 });
    expect(parseRefreshArgs(["30"])).toEqual({ seconds: 30 });
  });

  it("throws when a second positional argument is supplied", () => {
    expect(() => parseRefreshArgs(["5", "10"])).toThrow(
      /expected at most one <seconds> argument/,
    );
  });

  it("rejects a non-integer seconds argument", () => {
    expect(() => parseRefreshArgs(["1.5"])).toThrow(/non-negative integer/);
    expect(() => parseRefreshArgs(["abc"])).toThrow(/non-negative integer/);
    expect(() => parseRefreshArgs(["-1"])).toThrow(/unknown option '-1'/);
  });

  it("rejects an unknown flag-shaped argument", () => {
    expect(() => parseRefreshArgs(["--unknown"])).toThrow(/unknown option '--unknown'/);
    expect(() => parseRefreshArgs(["-x"])).toThrow(/unknown option '-x'/);
  });

  it("raises HelpRequestedError on -h / --help so the CLI dispatcher prints help", () => {
    expect(() => parseRefreshArgs(["-h"])).toThrow(HelpRequestedError);
    expect(() => parseRefreshArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("skips undefined slots in the argv tail (defensive — argv splits can leave holes)", () => {
    // `parseRefreshArgs` ignores `undefined` entries from a sparse rest array.
    const argv = ["5"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (argv as any)[3] = undefined;
    expect(parseRefreshArgs(argv)).toEqual({ seconds: 5 });
  });
});
