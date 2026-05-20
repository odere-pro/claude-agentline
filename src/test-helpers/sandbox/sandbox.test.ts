import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

import { withSandbox, withTmpDir } from "./sandbox.js";

describe("withTmpDir", () => {
  it("creates a tmpdir under the OS temp root and removes it after fn", async () => {
    let captured = "";
    await withTmpDir("agentline-test-", async (dir) => {
      captured = dir;
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });
    expect(captured).not.toBe("");
    await expect(fs.stat(captured)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("uses the supplied prefix in the directory name", async () => {
    await withTmpDir("agentline-prefix-", async (dir) => {
      expect(dir).toContain("agentline-prefix-");
    });
  });

  it("returns fn's value", async () => {
    const out = await withTmpDir("agentline-ret-", async () => 42);
    expect(out).toBe(42);
  });

  it("cleans up the tmpdir even when fn throws", async () => {
    let captured = "";
    await expect(
      withTmpDir("agentline-throw-", async (dir) => {
        captured = dir;
        await fs.writeFile(join(dir, "marker"), "x");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(fs.stat(captured)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

type Sandbox = { home: string; cfgDir: string; cwd: string };

describe("withSandbox", () => {
  it("allocates three disjoint tmpdirs and removes them all", async () => {
    const captured: Sandbox[] = [];
    await withSandbox(async (s) => {
      captured.push(s);
      expect(s.home).not.toBe(s.cfgDir);
      expect(s.cfgDir).not.toBe(s.cwd);
      expect(s.home).not.toBe(s.cwd);
      for (const dir of [s.home, s.cfgDir, s.cwd]) {
        const stat = await fs.stat(dir);
        expect(stat.isDirectory()).toBe(true);
      }
    });
    expect(captured).toHaveLength(1);
    const s = captured[0]!;
    for (const dir of [s.home, s.cfgDir, s.cwd]) {
      await expect(fs.stat(dir)).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("cleans up all three dirs even when fn throws", async () => {
    const captured: Sandbox[] = [];
    await expect(
      withSandbox(async (s) => {
        captured.push(s);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(captured).toHaveLength(1);
    const s = captured[0]!;
    for (const dir of [s.home, s.cfgDir, s.cwd]) {
      await expect(fs.stat(dir)).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
});
