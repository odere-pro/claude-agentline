import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteJson } from "./atomic.js";

describe("atomicWriteJson", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "agentline-atomic-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes a file with formatted JSON and trailing newline", async () => {
    const target = join(dir, "out.json");
    await atomicWriteJson(target, { a: 1, b: [2, 3] });
    const text = await fs.readFile(target, "utf8");
    expect(text).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n');
  });

  it("creates parent directories when missing", async () => {
    const target = join(dir, "deep", "nested", "out.json");
    await atomicWriteJson(target, { ok: true });
    const text = await fs.readFile(target, "utf8");
    expect(JSON.parse(text)).toEqual({ ok: true });
  });

  it("leaves no temp file behind on success", async () => {
    const target = join(dir, "out.json");
    await atomicWriteJson(target, { ok: true });
    const entries = await fs.readdir(dir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
  });

  it("overwrites an existing file atomically", async () => {
    const target = join(dir, "out.json");
    await atomicWriteJson(target, { v: 1 });
    await atomicWriteJson(target, { v: 2 });
    expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual({ v: 2 });
  });

  it("cleans up the temp file and rethrows when rename fails", async () => {
    const target = join(dir, "out.json");
    const renameSpy = vi
      .spyOn(fs, "rename")
      .mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    try {
      await expect(atomicWriteJson(target, { v: 1 })).rejects.toThrow("EACCES");
    } finally {
      renameSpy.mockRestore();
    }
    // The original target was never written, and the temp file must not linger.
    const entries = await fs.readdir(dir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
    await expect(fs.access(target)).rejects.toBeTruthy();
  });
});
