import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpRequestedError } from "../../core/lib/help/help.js";

/*
 * Mock the side-effecting collaborators so the command can be exercised
 * without spawning the real install script or touching the network.
 * `resolve-script` is mocked because, run from source, it resolves to a
 * path that does not exist and would throw before spawn. Mirrors the
 * harness in ../start/command.test.ts.
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
import { parseInstallArgs, runInstallCommand } from "./command.js";

const spawnMock = vi.mocked(spawnSync);
const refreshMock = vi.mocked(maybeRefresh);

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

describe("runInstallCommand — project gate", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-install-gate-"));
    spawnMock.mockClear();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("skips silently outside a Claude project on a non-TTY stdin (exit 0, no spawn)", async () => {
    const stdin = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
    stdin.isTTY = false;
    const code = await runInstallCommand(
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

describe("runInstallCommand — wiring + nudge", () => {
  let tmp: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // A directory that IS a Claude project so the gate proceeds.
    tmp = mkdtempSync(join(tmpdir(), "agentline-install-run-"));
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

  it("on a successful non-dry-run install, prints the next-steps nudge and refreshes the cache", async () => {
    const code = await runInstallCommand(
      { fromSource: false, force: false, dryRun: false },
      { cwd: tmp },
    );
    expect(code).toBe(0);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    // The nudge content (restart line, edit/uninstall, no doctor) is asserted
    // in ../next-steps/next-steps.test.ts; here we only prove it fired.
    expect(printed()).toContain("Next steps:");
  });

  it("dry-run forwards --dry-run, prints no nudge, and skips the refresh (gate-10 parity)", async () => {
    const code = await runInstallCommand(
      { fromSource: false, force: false, dryRun: true },
      { cwd: tmp },
    );
    expect(code).toBe(0);
    expect(argvOf()).toEqual(["--dry-run"]);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(printed()).not.toContain("Next steps:");
  });

  it("a failed install (non-zero status) prints no nudge and skips the refresh", async () => {
    spawnMock.mockReturnValue({ status: 1, error: undefined } as never);
    const code = await runInstallCommand(
      { fromSource: false, force: false, dryRun: false },
      { cwd: tmp },
    );
    expect(code).toBe(1);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(printed()).not.toContain("Next steps:");
  });

  it("forwards --from-source and --force to the install script", async () => {
    await runInstallCommand({ fromSource: true, force: true, dryRun: false }, { cwd: tmp });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(argvOf()).toEqual(["--from-source", "--force"]);
  });
});
