/**
 * TDD tests for `agentline config init`.
 *
 * All filesystem operations are scoped to a temp directory injected via
 * `CLAUDE_CONFIG_DIR` — never the real user config dir. Tests are RED until
 * the implementation is wired.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseInitArgs,
  runInitCommand,
  AVAILABLE_PRESETS,
} from "./init-command.js";

// ── helpers ──────────────────────────────────────────────────────────────────

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), "agentline-init-test-"));
}

async function cleanDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

// ── parseInitArgs ─────────────────────────────────────────────────────────────

describe("parseInitArgs", () => {
  it("defaults to preset=default, force=false", () => {
    expect(parseInitArgs([])).toEqual({ preset: "default", force: false });
  });

  it("--preset minimal sets preset", () => {
    expect(parseInitArgs(["--preset", "minimal"])).toEqual({
      preset: "minimal",
      force: false,
    });
  });

  it("--force sets force flag", () => {
    expect(parseInitArgs(["--force"])).toEqual({ preset: "default", force: true });
  });

  it("--preset and --force together", () => {
    expect(parseInitArgs(["--preset", "power", "--force"])).toEqual({
      preset: "power",
      force: true,
    });
  });

  it("rejects unknown flags", () => {
    expect(() => parseInitArgs(["--bogus"])).toThrow(/unknown.*option/i);
  });

  it("rejects --preset without a value", () => {
    expect(() => parseInitArgs(["--preset"])).toThrow(/requires a value/i);
  });
});

// ── runInitCommand — seed from preset ────────────────────────────────────────

describe("runInitCommand — seed from preset", () => {
  let tmpDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanDir(tmpDir);
  });

  it("seeds from the default preset when config does not exist", async () => {
    const code = await runInitCommand({
      args: { preset: "default", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });
    expect(code).toBe(0);

    const cfgPath = join(tmpDir, "agentline", "config.json");
    const written = JSON.parse(await fs.readFile(cfgPath, "utf8")) as { version: number };
    expect(written.version).toBe(1);

    const stdout = String(stdoutSpy.mock.calls[0]?.[0] ?? "");
    expect(stdout).toMatch(/seeded|overwritten/i);
    expect(stdout).toContain("default");
  });

  it("seeds from the minimal config template", async () => {
    const code = await runInitCommand({
      args: { preset: "minimal", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });
    expect(code).toBe(0);

    const cfgPath = join(tmpDir, "agentline", "config.json");
    const written = JSON.parse(await fs.readFile(cfgPath, "utf8")) as {
      lines: { widgets: { type: string }[] }[];
    };
    // minimal config template has exactly 1 line
    expect(written.lines).toHaveLength(1);
  });

  it("seeds from the power config template", async () => {
    const code = await runInitCommand({
      args: { preset: "power", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });
    expect(code).toBe(0);

    const cfgPath = join(tmpDir, "agentline", "config.json");
    const written = JSON.parse(await fs.readFile(cfgPath, "utf8")) as {
      lines: { widgets: { type: string }[] }[];
    };
    // power config template has 4 lines
    expect(written.lines).toHaveLength(4);
  });

  it("refuses to overwrite an existing config without --force", async () => {
    // First seed
    await runInitCommand({
      args: { preset: "default", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });

    // Reset spies
    vi.restoreAllMocks();
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    // Second seed — no --force
    const code = await runInitCommand({
      args: { preset: "default", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });
    expect(code).toBe(1);

    const stderr = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(stderr).toMatch(/already exists/i);
    expect(stderr).toMatch(/--force/i);
  });

  it("overwrites an existing config with --force", async () => {
    // Seed minimal first
    await runInitCommand({
      args: { preset: "minimal", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });

    // Overwrite with default using --force
    vi.restoreAllMocks();
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const code = await runInitCommand({
      args: { preset: "default", force: true },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });
    expect(code).toBe(0);

    const cfgPath = join(tmpDir, "agentline", "config.json");
    const written = JSON.parse(await fs.readFile(cfgPath, "utf8")) as {
      lines: { widgets: { type: string }[] }[];
    };
    // default has 3 lines
    expect(written.lines).toHaveLength(3);
  });

  it("returns error + lists presets for unknown preset name", async () => {
    const code = await runInitCommand({
      args: { preset: "bogus", force: false },
      env: { CLAUDE_CONFIG_DIR: tmpDir },
    });
    expect(code).toBe(1);

    const stderr = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(stderr).toMatch(/unknown config template/i);
    expect(stderr).toMatch(/bogus/);
    // All available config templates must be listed
    for (const p of AVAILABLE_PRESETS) {
      expect(stderr).toContain(p);
    }
  });

  it("written config validates (no schema drift)", async () => {
    const { validateConfig } = await import("../validate/validate.js");
    for (const preset of AVAILABLE_PRESETS) {
      vi.restoreAllMocks();
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const freshDir = await makeTempDir();
      try {
        await runInitCommand({
          args: { preset, force: false },
          env: { CLAUDE_CONFIG_DIR: freshDir },
        });
        const cfgPath = join(freshDir, "agentline", "config.json");
        const written = JSON.parse(await fs.readFile(cfgPath, "utf8")) as unknown;
        expect(() => validateConfig(written)).not.toThrow();
      } finally {
        await cleanDir(freshDir);
      }
    }
  });
});

// ── AVAILABLE_PRESETS ─────────────────────────────────────────────────────────

describe("AVAILABLE_PRESETS", () => {
  it("contains default, minimal, and power", () => {
    expect(AVAILABLE_PRESETS).toContain("default");
    expect(AVAILABLE_PRESETS).toContain("minimal");
    expect(AVAILABLE_PRESETS).toContain("power");
  });
});
