import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readVersionCheckSync, saveVersionCheck } from "../state/version-check-cache.js";
import { isNewer, maybeRefresh } from "./refresh.js";

let tmpRoot: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "agentline-refresh-"));
  env = { CLAUDE_CONFIG_DIR: tmpRoot };
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function fakeFetch(returns: string | null): typeof fetch {
  return (async () => ({
    ok: returns !== null,
    status: returns !== null ? 200 : 500,
    json: async () => ({ version: returns ?? undefined }),
  })) as unknown as typeof fetch;
}

describe("isNewer", () => {
  it("compares MAJOR.MINOR.PATCH numerically", () => {
    expect(isNewer("0.2.0", "0.1.0")).toBe(true);
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
    expect(isNewer("0.1.10", "0.1.9")).toBe(true);
    expect(isNewer("0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("0.1.0", "0.2.0")).toBe(false);
  });

  it("treats prerelease as lower priority than the stable triplet", () => {
    expect(isNewer("0.1.0", "0.1.0-rc.1")).toBe(true);
    expect(isNewer("0.1.0-rc.1", "0.1.0")).toBe(false);
    expect(isNewer("0.1.0-rc.2", "0.1.0-rc.1")).toBe(true);
  });

  it("tolerates a leading `v` prefix", () => {
    expect(isNewer("v0.2.0", "0.1.0")).toBe(true);
  });

  it("returns false for unparseable input rather than crying wolf", () => {
    expect(isNewer("not-a-version", "0.1.0")).toBe(false);
    expect(isNewer("0.1.0", "garbage")).toBe(false);
  });
});

describe("maybeRefresh", () => {
  it("fetches and persists on an empty cache", async () => {
    const outcome = await maybeRefresh({
      env,
      now: Date.parse("2026-05-14T00:00:00.000Z"),
      currentVersion: "0.1.0",
      fetchOptions: { fetchImpl: fakeFetch("0.2.0") },
    });
    expect(outcome.kind).toBe("refreshed");
    const stored = readVersionCheckSync(env);
    expect(stored?.latest).toBe("0.2.0");
    expect(stored?.current).toBe("0.1.0");
  });

  it("skips the fetch when the cache is within TTL", async () => {
    const recent = "2026-05-14T11:59:00.000Z";
    await saveVersionCheck({ savedAt: recent, current: "0.1.0", latest: "0.2.0" }, env);
    let fetchCalls = 0;
    const fakeFetchWithCounter = (async () => {
      fetchCalls += 1;
      return { ok: true, status: 200, json: async () => ({ version: "9.9.9" }) };
    }) as unknown as typeof fetch;
    const outcome = await maybeRefresh({
      env,
      now: Date.parse("2026-05-14T12:00:00.000Z"),
      currentVersion: "0.1.0",
      fetchOptions: { fetchImpl: fakeFetchWithCounter },
    });
    expect(outcome.kind).toBe("skipped-fresh");
    expect(fetchCalls).toBe(0);
    const stored = readVersionCheckSync(env);
    // Cache was NOT clobbered with the would-be fresh response.
    expect(stored?.latest).toBe("0.2.0");
  });

  it("re-fetches when the cache is older than TTL", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-13T00:00:00.000Z", current: "0.1.0", latest: "0.1.5" },
      env,
    );
    const outcome = await maybeRefresh({
      env,
      now: Date.parse("2026-05-14T12:00:00.000Z"),
      currentVersion: "0.1.0",
      fetchOptions: { fetchImpl: fakeFetch("0.2.0") },
    });
    expect(outcome.kind).toBe("refreshed");
    expect(readVersionCheckSync(env)?.latest).toBe("0.2.0");
  });

  it("preserves the prior `latest` on a fetch failure when a cache already exists", async () => {
    await saveVersionCheck(
      { savedAt: "2026-05-12T00:00:00.000Z", current: "0.1.0", latest: "0.1.5" },
      env,
    );
    const outcome = await maybeRefresh({
      env,
      now: Date.parse("2026-05-14T12:00:00.000Z"),
      currentVersion: "0.1.0",
      fetchOptions: { fetchImpl: fakeFetch(null) },
    });
    expect(outcome.kind).toBe("fetch-failed");
    // The pre-existing 0.1.5 is left in place rather than clobbered to null.
    expect(readVersionCheckSync(env)?.latest).toBe("0.1.5");
  });

  it("writes a `latest: null` entry on first-time failure so we don't refetch immediately", async () => {
    const outcome = await maybeRefresh({
      env,
      now: Date.parse("2026-05-14T12:00:00.000Z"),
      currentVersion: "0.1.0",
      fetchOptions: { fetchImpl: fakeFetch(null) },
    });
    expect(outcome.kind).toBe("fetch-failed");
    const stored = readVersionCheckSync(env);
    expect(stored?.latest).toBeNull();
    expect(stored?.current).toBe("0.1.0");
  });

  it("force: true bypasses the TTL", async () => {
    const recent = "2026-05-14T11:59:00.000Z";
    await saveVersionCheck({ savedAt: recent, current: "0.1.0", latest: "0.2.0" }, env);
    const outcome = await maybeRefresh({
      env,
      now: Date.parse("2026-05-14T12:00:00.000Z"),
      currentVersion: "0.1.0",
      force: true,
      fetchOptions: { fetchImpl: fakeFetch("0.3.0") },
    });
    expect(outcome.kind).toBe("refreshed");
    expect(readVersionCheckSync(env)?.latest).toBe("0.3.0");
  });
});
