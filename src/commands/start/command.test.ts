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
 * path that does not exist and would throw before spawn.
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
import { parseStartArgs, runStartCommand } from "./command.js";

const spawnMock = vi.mocked(spawnSync);
const refreshMock = vi.mocked(maybeRefresh);

describe("parseStartArgs", () => {
  it("returns all false with no arguments", () => {
    expect(parseStartArgs([])).toEqual({
      fromSource: false,
      force: false,
      dryRun: false,
      noPreview: false,
    });
  });

  it("sets each flag independently", () => {
    expect(parseStartArgs(["--from-source"]).fromSource).toBe(true);
    expect(parseStartArgs(["--force"]).force).toBe(true);
    expect(parseStartArgs(["--dry-run"]).dryRun).toBe(true);
    expect(parseStartArgs(["--no-preview"]).noPreview).toBe(true);
  });

  it("sets all flags together", () => {
    expect(parseStartArgs(["--from-source", "--force", "--dry-run", "--no-preview"])).toEqual({
      fromSource: true,
      force: true,
      dryRun: true,
      noPreview: true,
    });
  });

  it("throws HelpRequestedError for -h and --help", () => {
    expect(() => parseStartArgs(["-h"])).toThrow(HelpRequestedError);
    expect(() => parseStartArgs(["--help"])).toThrow(HelpRequestedError);
  });

  it("throws with the unknown flag name for an unrecognised flag", () => {
    expect(() => parseStartArgs(["--bogus"])).toThrow(/unknown argument.*--bogus/);
  });

  it("does NOT accept a --reset flag (start preserves config)", () => {
    expect(() => parseStartArgs(["--reset"])).toThrow(/unknown argument/);
  });
});

describe("runStartCommand — project gate", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-start-gate-"));
    spawnMock.mockClear();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("skips silently outside a Claude project on a non-TTY stdin (exit 0, no spawn)", async () => {
    const stdin = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
    stdin.isTTY = false;
    const code = await runStartCommand(
      { fromSource: false, force: false, dryRun: false, noPreview: false },
      { cwd: tmp, stdin },
    );
    expect(code).toBe(0);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("runStartCommand — wiring + preview", () => {
  let tmp: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // A directory that IS a Claude project so the gate proceeds.
    tmp = mkdtempSync(join(tmpdir(), "agentline-start-run-"));
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

  function argvOf(): string[] {
    const call = spawnMock.mock.calls[0];
    return (call?.[1] as string[]).slice(1); // drop the script path
  }

  it("never forwards --reset (config is preserved)", async () => {
    await runStartCommand(
      { fromSource: true, force: true, dryRun: false, noPreview: true },
      { cwd: tmp, renderPreview: async () => undefined },
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(argvOf()).not.toContain("--reset");
    expect(argvOf()).toEqual(["--from-source", "--force"]);
  });

  it("dry-run forwards --dry-run, skips refresh and preview", async () => {
    const preview = vi.fn(async () => "BAR\n");
    const code = await runStartCommand(
      { fromSource: false, force: false, dryRun: true, noPreview: false },
      { cwd: tmp, renderPreview: preview },
    );
    expect(code).toBe(0);
    expect(argvOf()).toEqual(["--dry-run"]);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
  });

  it("on success renders the preview and refreshes the update cache", async () => {
    const preview = vi.fn(async () => "[s] model\n");
    const code = await runStartCommand(
      { fromSource: false, force: false, dryRun: false, noPreview: false },
      { cwd: tmp, renderPreview: preview },
    );
    expect(code).toBe(0);
    expect(preview).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    const printed = writeSpy.mock.calls.map((c: readonly unknown[]) => String(c[0])).join("");
    expect(printed).toContain("[s] model");
  });

  it("--no-preview wires but does not render a preview", async () => {
    const preview = vi.fn(async () => "[s] model\n");
    await runStartCommand(
      { fromSource: false, force: false, dryRun: false, noPreview: true },
      { cwd: tmp, renderPreview: preview },
    );
    expect(preview).not.toHaveBeenCalled();
  });

  it("prints the unavailable notice when the preview cannot render", async () => {
    await runStartCommand(
      { fromSource: false, force: false, dryRun: false, noPreview: false },
      { cwd: tmp, renderPreview: async () => undefined },
    );
    const printed = writeSpy.mock.calls.map((c: readonly unknown[]) => String(c[0])).join("");
    expect(printed).toContain("preview unavailable");
  });

  it("returns the non-zero spawn status without rendering a preview", async () => {
    const preview = vi.fn(async () => "[s] model\n");
    spawnMock.mockReturnValue({ status: 3, error: undefined } as never);
    const code = await runStartCommand(
      { fromSource: false, force: false, dryRun: false, noPreview: false },
      { cwd: tmp, renderPreview: preview },
    );
    expect(code).toBe(3);
    expect(preview).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
