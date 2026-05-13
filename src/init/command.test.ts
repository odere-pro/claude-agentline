import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseInitArgs, runInitCommand } from "./command.js";

describe("parseInitArgs", () => {
  it("zero args → no force", () => {
    expect(parseInitArgs([])).toEqual({ force: false });
  });

  it("--force enables overwrite", () => {
    expect(parseInitArgs(["--force"])).toEqual({ force: true });
  });

  it("--preset is no longer accepted (CLI flatten dropped multi-preset selection)", () => {
    expect(() => parseInitArgs(["--preset", "minimal"])).toThrow(/unknown argument/);
    expect(() => parseInitArgs(["--preset=maximal"])).toThrow(/unknown argument/);
  });

  it("--target is no longer accepted (always writes the user config path)", () => {
    expect(() => parseInitArgs(["--target", "/etc/agentline.json"])).toThrow(/unknown argument/);
    expect(() => parseInitArgs(["--target=/x.json"])).toThrow(/unknown argument/);
  });

  it("--scope is no longer accepted", () => {
    expect(() => parseInitArgs(["--scope", "user"])).toThrow(/unknown argument/);
  });

  it("rejects unknown args", () => {
    expect(() => parseInitArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("runInitCommand", () => {
  let tmp: string;
  let templateDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-init-"));
    templateDir = mkdtempSync(join(tmpdir(), "agentline-init-tpl-"));
    writeFileSync(
      join(templateDir, "default.config.json"),
      JSON.stringify({ version: 1, marker: "default" }),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(templateDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes the default template to the resolved target", async () => {
    const target = join(tmp, "config.json");
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runInitCommand({
      args: { force: false },
      target,
      templateDir,
    });
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalled();
    expect(JSON.parse(readFileSync(target, "utf8")).marker).toBe("default");
  });

  it("default target → ${CLAUDE_CONFIG_DIR}/agentline/config.json", async () => {
    const userDir = join(tmp, "agentline");
    mkdirSync(userDir);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runInitCommand({
      args: { force: false },
      templateDir,
      env: { CLAUDE_CONFIG_DIR: tmp },
    });
    const written = JSON.parse(readFileSync(join(userDir, "config.json"), "utf8"));
    expect(written.marker).toBe("default");
  });

  it("post-write hint mentions verify and doctor", async () => {
    const target = join(tmp, "config.json");
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    await runInitCommand({
      args: { force: false },
      target,
      templateDir,
    });
    const out = writes.join("");
    expect(out).toContain("agentline doctor");
    expect(out).toContain("agentline doctor --fix");
  });

  it("refuses to overwrite without --force", async () => {
    const target = join(tmp, "exists.json");
    writeFileSync(target, "user content");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runInitCommand({
      args: { force: false },
      target,
      templateDir,
    });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalled();
    expect(readFileSync(target, "utf8")).toBe("user content");
  });

  it("--force overwrites existing file", async () => {
    const target = join(tmp, "exists.json");
    writeFileSync(target, "user content");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runInitCommand({
      args: { force: true },
      target,
      templateDir,
    });
    expect(code).toBe(0);
    expect(readFileSync(target, "utf8")).not.toBe("user content");
  });

  it("project gate skips silently outside a Claude project on a non-TTY stdin", async () => {
    // tmp has no `.claude/` or `CLAUDE.md`; an explicit non-TTY stdin
    // mimics a scripted run. The gate returns "skip"; init must not
    // touch the target file.
    const target = join(tmp, "config.json");
    const stdin = new PassThrough() as NodeJS.ReadableStream & { isTTY?: boolean };
    stdin.isTTY = false;
    const code = await runInitCommand({
      args: { force: false },
      target,
      templateDir,
      cwd: tmp,
      stdin,
    });
    expect(code).toBe(0);
    expect(existsSync(target)).toBe(false);
  });
});
