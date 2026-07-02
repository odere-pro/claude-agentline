import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readVersionCheckSync,
  resolveVersionCheckPaths,
  saveVersionCheck,
  stampNotifyVersion,
  VERSION_CHECK_CACHE_VERSION,
} from "./version-check-cache.js";

let tmpRoot: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "agentline-version-cache-"));
  env = { CLAUDE_CONFIG_DIR: tmpRoot };
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("resolveVersionCheckPaths", () => {
  it("honours CLAUDE_CONFIG_DIR", () => {
    const p = resolveVersionCheckPaths({ CLAUDE_CONFIG_DIR: "/x" });
    expect(p.stateDir).toBe(join("/x", "state"));
    expect(p.cacheFile).toBe(join("/x", "state", "version-check.json"));
  });

  it("falls back to ~/.config/agentline when CLAUDE_CONFIG_DIR is unset", () => {
    const p = resolveVersionCheckPaths({});
    expect(p.stateDir.endsWith(join(".config", "agentline", "state"))).toBe(true);
    expect(p.cacheFile.endsWith("version-check.json")).toBe(true);
  });
});

describe("saveVersionCheck + readVersionCheckSync", () => {
  it("round-trips a successful probe", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-14T00:00:00.000Z", current: "0.1.0", latest: "0.2.0" },
      env,
    );
    const got = readVersionCheckSync(env);
    expect(got).toEqual({
      version: VERSION_CHECK_CACHE_VERSION,
      savedAt: "2026-05-14T00:00:00.000Z",
      current: "0.1.0",
      latest: "0.2.0",
    });
  });

  it("accepts `latest: null` for failed probes", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-14T00:00:00.000Z", current: "0.1.0", latest: null },
      env,
    );
    const got = readVersionCheckSync(env);
    expect(got?.latest).toBeNull();
  });

  it("returns null when no cache exists", () => {
    expect(readVersionCheckSync(env)).toBeNull();
  });

  it("returns null when the file is malformed JSON", () => {
    const { stateDir, cacheFile } = resolveVersionCheckPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, "{not-json}");
    expect(readVersionCheckSync(env)).toBeNull();
  });

  it("returns null when the version field is unknown", () => {
    const { stateDir, cacheFile } = resolveVersionCheckPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify({ version: 99, savedAt: "x", current: "0.1.0", latest: null }),
    );
    expect(readVersionCheckSync(env)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const { stateDir, cacheFile } = resolveVersionCheckPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ version: 1, savedAt: "x" }));
    expect(readVersionCheckSync(env)).toBeNull();
  });

  it("swallows write errors so a broken cache dir never bubbles up", async () => {
    /*
     * Point at a path whose parent we can't create (a regular-file
     * "directory"). `saveVersionCheck` must NOT throw.
     */
    const blocker = join(tmpRoot, "blocker");
    writeFileSync(blocker, "i am not a directory");
    const blockerEnv = { CLAUDE_CONFIG_DIR: blocker };
    await expect(
      saveVersionCheck(
        { savedAt: "2026-05-14T00:00:00.000Z", current: "0.1.0", latest: "0.2.0" },
        blockerEnv,
      ),
    ).resolves.toBeUndefined();
  });

  it("round-trips an optional lastNotifyVersion field", async () => {
    await saveVersionCheck(
      {
        savedAt: "2026-05-14T00:00:00.000Z",
        current: "1.6.1",
        latest: null,
        lastNotifyVersion: "1.6.1",
      },
      env,
    );
    expect(readVersionCheckSync(env)?.lastNotifyVersion).toBe("1.6.1");
  });

  it("omits lastNotifyVersion from the round-trip when never stamped", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-14T00:00:00.000Z", current: "1.6.1", latest: null },
      env,
    );
    expect(readVersionCheckSync(env)?.lastNotifyVersion).toBeUndefined();
  });

  it("preserves an existing lastNotifyVersion when a later probe omits it", async () => {
    await stampNotifyVersion("1.6.1", "1.6.1", env);
    // A subsequent registry probe writes fresh current/latest but no notify stamp.
    await saveVersionCheck(
      { savedAt: "2026-06-01T00:00:00.000Z", current: "1.6.1", latest: "1.7.0" },
      env,
    );
    const got = readVersionCheckSync(env);
    expect(got?.latest).toBe("1.7.0");
    expect(got?.lastNotifyVersion).toBe("1.6.1");
  });

  it("returns null when lastNotifyVersion is the wrong type", () => {
    const { stateDir, cacheFile } = resolveVersionCheckPaths(env);
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify({ version: 1, savedAt: "x", current: "1.6.1", latest: null, lastNotifyVersion: 5 }),
    );
    expect(readVersionCheckSync(env)).toBeNull();
  });

  it("stampNotifyVersion preserves a prior probe's savedAt/current/latest", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-14T00:00:00.000Z", current: "1.6.0", latest: "1.6.1" },
      env,
    );
    await stampNotifyVersion("1.6.1", "1.6.1", env);
    const got = readVersionCheckSync(env);
    expect(got?.savedAt).toBe("2026-05-14T00:00:00.000Z");
    expect(got?.latest).toBe("1.6.1");
    expect(got?.lastNotifyVersion).toBe("1.6.1");
  });

  it("stampNotifyVersion writes a fresh entry when no cache exists", async () => {
    await stampNotifyVersion("1.6.1", "1.6.1", env);
    const got = readVersionCheckSync(env);
    expect(got?.lastNotifyVersion).toBe("1.6.1");
    expect(got?.current).toBe("1.6.1");
    expect(typeof got?.savedAt).toBe("string");
  });

  it("persists the file under state/version-check.json", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-14T00:00:00.000Z", current: "0.1.0", latest: "0.2.0" },
      env,
    );
    const { cacheFile } = resolveVersionCheckPaths(env);
    const raw = JSON.parse(readFileSync(cacheFile, "utf8"));
    expect(raw.version).toBe(VERSION_CHECK_CACHE_VERSION);
    expect(raw.current).toBe("0.1.0");
    expect(raw.latest).toBe("0.2.0");
  });
});
