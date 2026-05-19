import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pathExists } from "./fs.js";

describe("pathExists", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-fs-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns true for an existing file", async () => {
    const file = join(tmp, "exists.txt");
    writeFileSync(file, "hello");
    expect(await pathExists(file)).toBe(true);
  });

  it("returns true for an existing directory", async () => {
    expect(await pathExists(tmp)).toBe(true);
  });

  it("returns false for a non-existent path", async () => {
    expect(await pathExists(join(tmp, "missing"))).toBe(false);
  });

  it("never throws — swallows access errors", async () => {
    await expect(pathExists("/proc/1/will-not-exist-here-xyz")).resolves.toBeTypeOf("boolean");
  });
});
