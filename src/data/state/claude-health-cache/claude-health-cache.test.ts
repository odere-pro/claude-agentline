import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CLAUDE_HEALTH_CACHE_VERSION,
  readClaudeHealthSync,
  resolveClaudeHealthPaths,
  saveClaudeHealth,
  type ClaudeHealthCache,
} from "./claude-health-cache.js";
import { loadClaudeHealthSnapshot } from "./snapshot.js";

let tmpRoot: string;
let env: NodeJS.ProcessEnv;

const SAMPLE: Omit<ClaudeHealthCache, "version"> = {
  savedAt: "2026-05-14T00:00:00.000Z",
  cliVersion: "1.2.0",
  latestVersion: "1.3.0",
  needsUpdate: true,
  doctor: { status: "warn", issues: 0, warnings: 2 },
};

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "agentline-claude-health-"));
  env = { CLAUDE_CONFIG_DIR: tmpRoot };
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("resolveClaudeHealthPaths", () => {
  it("honours CLAUDE_CONFIG_DIR", () => {
    const p = resolveClaudeHealthPaths({ CLAUDE_CONFIG_DIR: "/x" });
    expect(p.stateDir).toBe(join("/x", "state"));
    expect(p.cacheFile).toBe(join("/x", "state", "claude-health.json"));
  });

  it("falls back to ~/.config/agentline when CLAUDE_CONFIG_DIR is unset", () => {
    const p = resolveClaudeHealthPaths({});
    expect(p.stateDir.endsWith(join(".config", "agentline", "state"))).toBe(true);
    expect(p.cacheFile.endsWith("claude-health.json")).toBe(true);
  });
});

describe("saveClaudeHealth + readClaudeHealthSync", () => {
  it("round-trips a full probe", async () => {
    await saveClaudeHealth(SAMPLE, env);
    expect(readClaudeHealthSync(env)).toEqual({
      version: CLAUDE_HEALTH_CACHE_VERSION,
      ...SAMPLE,
    });
  });

  it("accepts null versions and a null doctor for failed probes", async () => {
    await saveClaudeHealth(
      { savedAt: "x", cliVersion: null, latestVersion: null, needsUpdate: false, doctor: null },
      env,
    );
    const got = readClaudeHealthSync(env);
    expect(got?.cliVersion).toBeNull();
    expect(got?.doctor).toBeNull();
  });

  it("returns null when no cache exists", () => {
    expect(readClaudeHealthSync(env)).toBeNull();
  });

  it("returns null when the file is malformed JSON", () => {
    const { stateDir, cacheFile } = resolveClaudeHealthPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, "{not-json}");
    expect(readClaudeHealthSync(env)).toBeNull();
  });

  it("returns null when the version field is unknown", () => {
    const { stateDir, cacheFile } = resolveClaudeHealthPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ version: 99, ...SAMPLE }));
    expect(readClaudeHealthSync(env)).toBeNull();
  });

  it("returns null when the doctor summary is malformed", () => {
    const { stateDir, cacheFile } = resolveClaudeHealthPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify({
        version: 1,
        savedAt: "x",
        cliVersion: "1.0.0",
        latestVersion: "1.0.0",
        needsUpdate: false,
        doctor: { status: "bogus", issues: 0, warnings: 0 },
      }),
    );
    expect(readClaudeHealthSync(env)).toBeNull();
  });

  it("swallows write errors so a broken cache dir never bubbles up", async () => {
    const blocker = join(tmpRoot, "blocker");
    writeFileSync(blocker, "i am not a directory");
    await expect(
      saveClaudeHealth(SAMPLE, { CLAUDE_CONFIG_DIR: blocker }),
    ).resolves.toBeUndefined();
  });

  it("persists the file under state/claude-health.json", async () => {
    await saveClaudeHealth(SAMPLE, env);
    const { cacheFile } = resolveClaudeHealthPaths(env);
    const raw = JSON.parse(readFileSync(cacheFile, "utf8"));
    expect(raw.version).toBe(CLAUDE_HEALTH_CACHE_VERSION);
    expect(raw.needsUpdate).toBe(true);
  });
});

describe("loadClaudeHealthSnapshot", () => {
  it("reports unavailable when the cache is absent", () => {
    expect(loadClaudeHealthSnapshot({ env })).toEqual({ available: false });
  });

  it("maps a populated cache to an available snapshot", async () => {
    await saveClaudeHealth(SAMPLE, env);
    expect(loadClaudeHealthSnapshot({ env })).toEqual({
      available: true,
      cliVersion: "1.2.0",
      latestVersion: "1.3.0",
      needsUpdate: true,
      doctor: { status: "warn", issues: 0, warnings: 2 },
    });
  });

  it("returns a frozen snapshot", async () => {
    await saveClaudeHealth(SAMPLE, env);
    expect(Object.isFrozen(loadClaudeHealthSnapshot({ env }))).toBe(true);
  });
});
