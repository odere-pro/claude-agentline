import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  STDIN_CACHE_VERSION,
  readLastStdinSync,
  resolveCachePaths,
  saveLastStdin,
} from "./stdin-cache.js";

const samplePayload = {
  raw: { model: "claude-opus", cwd: "/agentline" },
  truncated: false,
  model: "claude-opus",
  cwd: "/agentline",
};

describe("resolveCachePaths", () => {
  it("uses $CLAUDE_CONFIG_DIR when set", () => {
    const p = resolveCachePaths({ CLAUDE_CONFIG_DIR: "/tmp/x" });
    expect(p.stateDir).toBe("/tmp/x/state");
    expect(p.cacheFile).toBe("/tmp/x/state/last-stdin.json");
  });
});

describe("saveLastStdin + readLastStdinSync", () => {
  let tmp: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-stdin-cache-"));
    env = { CLAUDE_CONFIG_DIR: tmp };
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("round-trips a payload", async () => {
    await saveLastStdin(samplePayload, { env });
    const read = readLastStdinSync(env);
    expect(read?.version).toBe(STDIN_CACHE_VERSION);
    expect(read?.payload.model).toBe("claude-opus");
    expect(read?.payload.cwd).toBe("/agentline");
  });

  it("returns null when the cache file is absent", () => {
    expect(readLastStdinSync(env)).toBeNull();
  });

  it("returns null when the cache JSON is malformed", () => {
    const { cacheFile, stateDir } = resolveCachePaths(env);
    // Pre-create the directory so the malformed JSON write succeeds.
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, "{not json");
    expect(readLastStdinSync(env)).toBeNull();
  });

  it("returns null when the cache version is unknown", () => {
    const { cacheFile, stateDir } = resolveCachePaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ version: 99, savedAt: "x", payload: samplePayload }));
    expect(readLastStdinSync(env)).toBeNull();
  });

  it("save swallows write errors instead of throwing", async () => {
    // Point at a path the runtime can't create — the helper must NOT throw.
    const broken = { CLAUDE_CONFIG_DIR: "\0/invalid" };
    await expect(saveLastStdin(samplePayload, { env: broken })).resolves.toBeUndefined();
  });

  it("savedAt records the supplied clock", async () => {
    const fixed = new Date("2026-05-13T10:00:00.000Z");
    await saveLastStdin(samplePayload, { env, clock: () => fixed });
    const read = readLastStdinSync(env);
    expect(read?.savedAt).toBe("2026-05-13T10:00:00.000Z");
  });
});
