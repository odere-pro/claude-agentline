import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpRequestedError } from "../../core/lib/help/help.js";

/*
 * Mock the side-effecting collaborators so the command can be exercised
 * without spawning the real install script or touching the network.
 * Mirrors the harness in ../install/command.test.ts and ../start/command.test.ts.
 */
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0, error: undefined })),
}));
vi.mock("../../core/lib/resolve-script.js", () => ({
  resolveScript: vi.fn(() => "/fake/scripts/install.sh"),
}));
vi.mock("../update-check/index.js", () => ({
  maybeRefresh: vi.fn(() => Promise.resolve()),
}));

import { spawnSync } from "node:child_process";
import { maybeRefresh } from "../update-check/index.js";
import { parseResetArgs, runResetCommand } from "./command.js";

const spawnMock = vi.mocked(spawnSync);
const refreshMock = vi.mocked(maybeRefresh);

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
    spawnMock.mockClear();
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
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("runResetCommand — wiring + nudge", () => {
  let tmp: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // A directory that IS a Claude project so the gate proceeds.
    tmp = mkdtempSync(join(tmpdir(), "agentline-reset-run-"));
    writeFileSync(join(tmp, "CLAUDE.md"), "# project\n");
    spawnMock.mockClear();
    refreshMock.mockClear();
    spawnMock.mockReturnValue({ status: 0, error: undefined } as never);
    writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    rmSync(tmp, { recursive: true, force: true });
  });

  function printed(): string {
    return writeSpy.mock.calls.map((c: readonly unknown[]) => String(c[0])).join("");
  }

  function argvOf(): string[] {
    const call = spawnMock.mock.calls[0];
    return (call?.[1] as string[]).slice(1); // drop the script path
  }

  it("always forwards --reset and, on success, prints the next-steps nudge + refreshes", async () => {
    const code = await runResetCommand(
      { fromSource: false, force: false, dryRun: false },
      { cwd: tmp },
    );
    expect(code).toBe(0);
    expect(argvOf()).toEqual(["--reset"]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    // Reset is the documented fresh-setup verb, so it shows the same nudge as
    // install. Content is asserted in ../next-steps/next-steps.test.ts.
    expect(printed()).toContain("Next steps:");
  });

  it("dry-run forwards --reset --dry-run, prints no nudge, and skips the refresh", async () => {
    const code = await runResetCommand(
      { fromSource: false, force: false, dryRun: true },
      { cwd: tmp },
    );
    expect(code).toBe(0);
    expect(argvOf()).toEqual(["--reset", "--dry-run"]);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(printed()).not.toContain("Next steps:");
  });

  it("a failed reset (non-zero status) prints no nudge and skips the refresh", async () => {
    spawnMock.mockReturnValue({ status: 1, error: undefined } as never);
    const code = await runResetCommand(
      { fromSource: false, force: false, dryRun: false },
      { cwd: tmp },
    );
    expect(code).toBe(1);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(printed()).not.toContain("Next steps:");
  });

  it("forwards --from-source and --force alongside --reset", async () => {
    await runResetCommand({ fromSource: true, force: true, dryRun: false }, { cwd: tmp });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(argvOf()).toEqual(["--reset", "--from-source", "--force"]);
  });
});
