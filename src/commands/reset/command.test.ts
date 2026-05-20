import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HelpRequestedError } from "../../core/lib/help/help.js";
import { parseResetArgs, runResetCommand } from "./command.js";

describe("parseResetArgs", () => {
  it("returns all false with no arguments", () => {
    expect(parseResetArgs([])).toEqual({ fromSource: false, force: false, dryRun: false });
  });

  it("sets fromSource when --from-source is passed", () => {
    const args = parseResetArgs(["--from-source"]);
    expect(args.fromSource).toBe(true);
    expect(args.force).toBe(false);
    expect(args.dryRun).toBe(false);
  });

  it("sets force when --force is passed", () => {
    const args = parseResetArgs(["--force"]);
    expect(args.force).toBe(true);
    expect(args.fromSource).toBe(false);
    expect(args.dryRun).toBe(false);
  });

  it("sets dryRun when --dry-run is passed", () => {
    const args = parseResetArgs(["--dry-run"]);
    expect(args.dryRun).toBe(true);
    expect(args.fromSource).toBe(false);
    expect(args.force).toBe(false);
  });

  it("sets all three flags together", () => {
    const args = parseResetArgs(["--from-source", "--force", "--dry-run"]);
    expect(args).toEqual({ fromSource: true, force: true, dryRun: true });
  });

  it("throws HelpRequestedError for -h", () => {
    expect(() => parseResetArgs(["-h"])).toThrow(HelpRequestedError);
  });

  it("throws HelpRequestedError for --help", () => {
    expect(() => parseResetArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("throws Error with 'unknown argument' for unrecognised flag", () => {
    expect(() => parseResetArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("throws Error with the unknown flag name in the message", () => {
    expect(() => parseResetArgs(["--unknown-flag"])).toThrow(/unknown-flag/);
  });

  it("does NOT accept a user-facing --reset flag (it is implicit)", () => {
    expect(() => parseResetArgs(["--reset"])).toThrow(/unknown argument/);
  });
});

describe("runResetCommand — project gate", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-reset-gate-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("skips silently outside a Claude project on a non-TTY stdin (exit 0, no spawn)", async () => {
    const stdin = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
    stdin.isTTY = false;
    const code = await runResetCommand(
      { fromSource: false, force: false, dryRun: false },
      { cwd: tmp, stdin },
    );
    /*
     * Gate short-circuits before spawnSync ever runs the install script,
     * so the temp dir stays untouched and we get a clean exit.
     */
    expect(code).toBe(0);
  });
});
