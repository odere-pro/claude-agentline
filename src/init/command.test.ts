import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseInitArgs, runInitCommand } from "./command.js";

describe("parseInitArgs", () => {
  it("zero args → preset 'default', scope 'project', no force, no target", () => {
    expect(parseInitArgs([])).toEqual({ preset: "default", scope: "project", force: false });
  });

  it("--minimal is no longer accepted (removed in the minimal|default|maximal restructure)", () => {
    expect(() => parseInitArgs(["--minimal"])).toThrow(/unknown argument/);
  });

  it("--preset selects each shipped preset", () => {
    for (const p of ["minimal", "default", "maximal"] as const) {
      expect(parseInitArgs(["--preset", p])).toMatchObject({ preset: p });
      expect(parseInitArgs([`--preset=${p}`])).toMatchObject({ preset: p });
    }
  });

  it("--scope user|project", () => {
    expect(parseInitArgs(["--scope", "user"])).toMatchObject({ scope: "user" });
    expect(parseInitArgs(["--scope=project"])).toMatchObject({ scope: "project" });
  });

  it("--force enables overwrite", () => {
    expect(parseInitArgs(["--force"])).toMatchObject({ force: true });
  });

  it("--target overrides scope-derived path", () => {
    expect(parseInitArgs(["--target", "/etc/agentline.json"])).toMatchObject({
      target: "/etc/agentline.json",
    });
    expect(parseInitArgs(["--target=/x.json"])).toMatchObject({ target: "/x.json" });
  });

  it("rejects unknown preset / scope / arg", () => {
    expect(() => parseInitArgs(["--preset", "ultra"])).toThrow(/unknown preset/);
    expect(() => parseInitArgs(["--preset", "focus"])).toThrow(/unknown preset/);
    expect(() => parseInitArgs(["--preset", "power"])).toThrow(/unknown preset/);
    expect(() => parseInitArgs(["--scope", "global"])).toThrow(/unknown scope/);
    expect(() => parseInitArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  it("rejects flags without values", () => {
    expect(() => parseInitArgs(["--preset"])).toThrow(/--preset requires/);
    expect(() => parseInitArgs(["--scope"])).toThrow(/--scope requires/);
    expect(() => parseInitArgs(["--target"])).toThrow(/--target requires/);
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
    writeFileSync(
      join(templateDir, "minimal.config.json"),
      JSON.stringify({ version: 1, marker: "minimal" }),
    );
    mkdirSync(join(templateDir, "presets"));
    writeFileSync(
      join(templateDir, "presets", "maximal.config.json"),
      JSON.stringify({ version: 1, marker: "maximal" }),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(templateDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes the default preset to an explicit target", async () => {
    const target = join(tmp, ".agentline.json");
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await runInitCommand({
      args: { preset: "default", scope: "project", force: false, target },
      templateDir,
    });
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalled();
    expect(JSON.parse(readFileSync(target, "utf8")).marker).toBe("default");
  });

  it("--preset minimal writes the minimal preset", async () => {
    const target = join(tmp, ".agentline.json");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runInitCommand({
      args: { preset: "minimal", scope: "project", force: false, target },
      templateDir,
    });
    expect(JSON.parse(readFileSync(target, "utf8")).marker).toBe("minimal");
  });

  it("--preset maximal writes the maximal preset", async () => {
    const target = join(tmp, ".agentline.json");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runInitCommand({
      args: { preset: "maximal", scope: "project", force: false, target },
      templateDir,
    });
    expect(JSON.parse(readFileSync(target, "utf8")).marker).toBe("maximal");
  });

  it("scope=project → writes .agentline.json in the project dir", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runInitCommand({
      args: { preset: "minimal", scope: "project", force: false },
      templateDir,
      env: { CLAUDE_PROJECT_DIR: tmp, CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
    });
    const written = JSON.parse(readFileSync(join(tmp, ".agentline.json"), "utf8"));
    expect(written.marker).toBe("minimal");
  });

  it("scope=user → writes ~/.config/agentline/config.json equivalent", async () => {
    const userDir = join(tmp, "agentline");
    mkdirSync(userDir);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await runInitCommand({
      args: { preset: "default", scope: "user", force: false },
      templateDir,
      env: { CLAUDE_CONFIG_DIR: tmp },
      cwd: tmp,
    });
    const written = JSON.parse(readFileSync(join(userDir, "config.json"), "utf8"));
    expect(written.marker).toBe("default");
  });

  it("post-write hint mentions verify and doctor", async () => {
    const target = join(tmp, ".agentline.json");
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    await runInitCommand({
      args: { preset: "default", scope: "project", force: false, target },
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
      args: { preset: "default", scope: "project", force: false, target },
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
      args: { preset: "default", scope: "project", force: true, target },
      templateDir,
    });
    expect(code).toBe(0);
    expect(readFileSync(target, "utf8")).not.toBe("user content");
  });
});
