import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readClaudeHealthSync,
  saveClaudeHealth,
} from "../../../data/state/claude-health-cache/claude-health-cache.js";
import { maybeRefreshClaudeHealth } from "./refresh.js";

let tmpRoot: string;
let env: NodeJS.ProcessEnv;

const okFetch = (async () => ({
  ok: true,
  json: async () => ({ version: "1.5.0" }),
})) as unknown as typeof fetch;
const failFetch = (async () => ({ ok: false })) as unknown as typeof fetch;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "agentline-claude-health-refresh-"));
  env = { CLAUDE_CONFIG_DIR: tmpRoot };
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("maybeRefreshClaudeHealth", () => {
  it("probes and writes a fresh cache when none exists", async () => {
    const out = await maybeRefreshClaudeHealth({
      env,
      now: Date.parse("2026-05-14T00:00:00.000Z"),
      fetchOptions: { fetchImpl: okFetch },
      invoke: {
        version: () => "1.2.0 (cli build)",
        doctor: () => "⚠ Node outdated",
      },
    });
    expect(out.kind).toBe("refreshed");
    const cache = readClaudeHealthSync(env);
    expect(cache?.cliVersion).toBe("1.2.0");
    expect(cache?.latestVersion).toBe("1.5.0");
    expect(cache?.needsUpdate).toBe(true);
    expect(cache?.doctor).toEqual({ status: "warn", issues: 0, warnings: 1 });
  });

  it("skips the probe when the cache is fresh", async () => {
    const now = Date.parse("2026-05-14T00:00:00.000Z");
    await saveClaudeHealth(
      { savedAt: new Date(now).toISOString(), cliVersion: "1.0.0", latestVersion: "1.0.0", needsUpdate: false, doctor: null },
      env,
    );
    let probed = false;
    const out = await maybeRefreshClaudeHealth({
      env,
      now: now + 1000,
      invoke: {
        version: () => {
          probed = true;
          return "9.9.9";
        },
      },
    });
    expect(out.kind).toBe("skipped-fresh");
    expect(probed).toBe(false);
  });

  it("refreshes once the cache is stale (>24h)", async () => {
    const saved = Date.parse("2026-05-14T00:00:00.000Z");
    await saveClaudeHealth(
      { savedAt: new Date(saved).toISOString(), cliVersion: "1.0.0", latestVersion: "1.0.0", needsUpdate: false, doctor: null },
      env,
    );
    const out = await maybeRefreshClaudeHealth({
      env,
      now: saved + 25 * 60 * 60 * 1000,
      fetchOptions: { fetchImpl: okFetch },
      invoke: { version: () => "1.2.0", doctor: () => "all good" },
    });
    expect(out.kind).toBe("refreshed");
    expect(readClaudeHealthSync(env)?.cliVersion).toBe("1.2.0");
  });

  it("preserves a prior latestVersion when the npm probe fails", async () => {
    const saved = Date.parse("2026-05-14T00:00:00.000Z");
    await saveClaudeHealth(
      { savedAt: new Date(saved).toISOString(), cliVersion: "1.0.0", latestVersion: "1.4.0", needsUpdate: true, doctor: null },
      env,
    );
    const out = await maybeRefreshClaudeHealth({
      env,
      now: saved + 25 * 60 * 60 * 1000,
      fetchOptions: { fetchImpl: failFetch },
      invoke: { version: () => "1.0.0", doctor: () => "ok" },
    });
    expect(out.kind).toBe("refreshed");
    const cache = readClaudeHealthSync(env);
    expect(cache?.latestVersion).toBe("1.4.0");
    expect(cache?.needsUpdate).toBe(true);
  });

  it("records cliVersion null and needsUpdate false when claude is absent", async () => {
    const out = await maybeRefreshClaudeHealth({
      env,
      now: Date.parse("2026-05-14T00:00:00.000Z"),
      fetchOptions: { fetchImpl: okFetch },
      invoke: { version: () => null, doctor: () => null },
    });
    expect(out.kind).toBe("refreshed");
    const cache = readClaudeHealthSync(env);
    expect(cache?.cliVersion).toBeNull();
    expect(cache?.needsUpdate).toBe(false);
    expect(cache?.doctor).toBeNull();
  });
});
