import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RENDER_CACHE_VERSION,
  readLastRenderSync,
  resolveRenderCachePaths,
  saveLastRender,
} from "./render-cache.js";

const ESC = "\x1b[";

describe("resolveRenderCachePaths", () => {
  it("uses $CLAUDE_CONFIG_DIR when set", () => {
    const p = resolveRenderCachePaths({ CLAUDE_CONFIG_DIR: "/tmp/x" });
    expect(p.stateDir).toBe(join("/tmp/x", "state"));
    expect(p.cacheFile).toBe(join("/tmp/x", "state", "last-render.json"));
  });
});

describe("saveLastRender + readLastRenderSync", () => {
  let tmp: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agentline-render-cache-"));
    env = { CLAUDE_CONFIG_DIR: tmp };
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("round-trips a render payload", async () => {
    const rendered = `${ESC}32mgreen${ESC}0m statusline\n`;
    const clock = () => new Date("2026-05-13T22:00:00Z");
    await saveLastRender(rendered, {
      env,
      clock,
      meta: { width: 120, lineCount: 1 },
    });
    const out = readLastRenderSync(env);
    expect(out?.version).toBe(RENDER_CACHE_VERSION);
    expect(out?.rendered).toBe(rendered);
    expect(out?.savedAt).toBe("2026-05-13T22:00:00.000Z");
    expect(out?.meta).toEqual({ width: 120, lineCount: 1 });
  });

  it("returns null when the cache file is missing", () => {
    expect(readLastRenderSync(env)).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    const { cacheFile, stateDir } = resolveRenderCachePaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, "{not json", "utf8");
    expect(readLastRenderSync(env)).toBeNull();
  });

  it("returns null when version drifts", () => {
    const { cacheFile, stateDir } = resolveRenderCachePaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify({ version: 999, savedAt: "x", rendered: "hi", meta: {} }),
      "utf8",
    );
    expect(readLastRenderSync(env)).toBeNull();
  });

  it("returns null when rendered is missing or not a string", () => {
    const { cacheFile, stateDir } = resolveRenderCachePaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify({ version: RENDER_CACHE_VERSION, savedAt: "x", meta: {} }),
      "utf8",
    );
    expect(readLastRenderSync(env)).toBeNull();
  });

  it("tolerates a missing meta object", () => {
    const { cacheFile, stateDir } = resolveRenderCachePaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify({
        version: RENDER_CACHE_VERSION,
        savedAt: "2026-01-01T00:00:00Z",
        rendered: "hi",
      }),
      "utf8",
    );
    const out = readLastRenderSync(env);
    expect(out?.rendered).toBe("hi");
    expect(out?.meta).toEqual({});
  });

  it("is best-effort — broken state dir does not throw", async () => {
    const broken = { CLAUDE_CONFIG_DIR: "\0/cannot/exist" };
    await expect(saveLastRender("x", { env: broken })).resolves.toBeUndefined();
  });
});
