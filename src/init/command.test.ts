import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseInitArgs, runInitCommand } from "./command.js";

describe("parseInitArgs", () => {
  it("defaults to non-minimal, non-force, no target override", () => {
    expect(parseInitArgs([])).toEqual({ minimal: false, force: false });
  });

  it("--minimal selects the smaller template", () => {
    expect(parseInitArgs(["--minimal"])).toEqual({ minimal: true, force: false });
  });

  it("--force enables overwrite", () => {
    expect(parseInitArgs(["--force"])).toEqual({ minimal: false, force: true });
  });

  it("--target accepts an explicit path", () => {
    expect(parseInitArgs(["--target", "/etc/agentline.json"])).toEqual({
      minimal: false,
      force: false,
      target: "/etc/agentline.json",
    });
    expect(parseInitArgs(["--target=/x.json"])).toMatchObject({ target: "/x.json" });
  });

  it("rejects unknown args", () => {
    expect(() => parseInitArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("rejects --target without a value", () => {
    expect(() => parseInitArgs(["--target"])).toThrow(/requires a path/);
    expect(() => parseInitArgs(["--target", "--minimal"])).toThrow(/requires a path/);
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
      JSON.stringify({ version: 1, default: true }),
    );
    writeFileSync(
      join(templateDir, "minimal.config.json"),
      JSON.stringify({ version: 1, minimal: true }),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(templateDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes the default template to the target path", async () => {
    const target = join(tmp, ".agentline.json");
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runInitCommand({
      args: { minimal: false, force: false, target },
      templateDir,
    });
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalled();
    const written = JSON.parse(readFileSync(target, "utf8"));
    expect(written.default).toBe(true);
  });

  it("--minimal selects the smaller template", async () => {
    const target = join(tmp, ".agentline.json");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runInitCommand({
      args: { minimal: true, force: false, target },
      templateDir,
    });
    const written = JSON.parse(readFileSync(target, "utf8"));
    expect(written.minimal).toBe(true);
  });

  it("refuses to overwrite without --force", async () => {
    const target = join(tmp, "exists.json");
    writeFileSync(target, "user content");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await runInitCommand({
      args: { minimal: false, force: false, target },
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
      args: { minimal: false, force: true, target },
      templateDir,
    });
    expect(code).toBe(0);
    expect(readFileSync(target, "utf8")).not.toBe("user content");
  });
});
