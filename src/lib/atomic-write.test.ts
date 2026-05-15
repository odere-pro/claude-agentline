import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeIdempotent,
  writeJsonIdempotent,
  writeOnce,
} from "./atomic-write.js";

describe("writeJsonIdempotent", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "agentline-atomic-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes formatted JSON with a trailing newline", async () => {
    const target = join(dir, "out.json");
    await writeJsonIdempotent(target, { a: 1, b: [2, 3] });
    expect(await fs.readFile(target, "utf8")).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n',
    );
  });

  it("creates parent directories on demand", async () => {
    const target = join(dir, "deep", "nested", "out.json");
    await writeJsonIdempotent(target, { ok: true });
    expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual({ ok: true });
  });

  it("leaves no temp file behind on success", async () => {
    const target = join(dir, "out.json");
    await writeJsonIdempotent(target, { ok: true });
    const entries = await fs.readdir(dir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
  });

  it("overwrites an existing file (idempotent)", async () => {
    const target = join(dir, "out.json");
    await writeJsonIdempotent(target, { v: 1 });
    await writeJsonIdempotent(target, { v: 2 });
    expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual({ v: 2 });
  });

  it("cleans up the temp file and rethrows when rename fails", async () => {
    const target = join(dir, "out.json");
    const renameSpy = vi
      .spyOn(fs, "rename")
      .mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    try {
      await expect(writeJsonIdempotent(target, { v: 1 })).rejects.toThrow("EACCES");
    } finally {
      renameSpy.mockRestore();
    }
    const entries = await fs.readdir(dir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
    await expect(fs.access(target)).rejects.toBeTruthy();
  });
});

describe("writeIdempotent", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "agentline-atomic-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("accepts a Buffer payload", async () => {
    const target = join(dir, "blob.bin");
    await writeIdempotent(target, Buffer.from([0x68, 0x69]));
    expect(await fs.readFile(target)).toEqual(Buffer.from([0x68, 0x69]));
  });

  it("accepts a string payload", async () => {
    const target = join(dir, "blob.txt");
    await writeIdempotent(target, "hello");
    expect(await fs.readFile(target, "utf8")).toBe("hello");
  });

  it("honours the file mode option", async () => {
    const target = join(dir, "secret.txt");
    await writeIdempotent(target, "x", { mode: 0o600 });
    const stat = await fs.stat(target);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe("writeOnce", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "agentline-atomic-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("creates the file on first call", async () => {
    const target = join(dir, "once.json");
    await writeOnce(target, '{"v":1}\n');
    expect(await fs.readFile(target, "utf8")).toBe('{"v":1}\n');
  });

  it("throws EEXIST when the file already exists", async () => {
    const target = join(dir, "once.json");
    await fs.writeFile(target, "existing");
    await expect(writeOnce(target, "new")).rejects.toMatchObject({ code: "EEXIST" });
    expect(await fs.readFile(target, "utf8")).toBe("existing");
  });

  it("creates parent directories on demand", async () => {
    const target = join(dir, "deep", "once.txt");
    await writeOnce(target, "ok");
    expect(await fs.readFile(target, "utf8")).toBe("ok");
  });

  it("honours the file mode option", async () => {
    const target = join(dir, "secret.txt");
    await writeOnce(target, "x", { mode: 0o600 });
    const stat = await fs.stat(target);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
