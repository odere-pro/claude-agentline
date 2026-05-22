import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SESSION_PLAN_CACHE_VERSION,
  readSessionPlanEntrySync,
  recordSessionPlan,
  resolveSessionPlanPaths,
} from "./session-plan-cache.js";

let tmp: string;
let env: NodeJS.ProcessEnv;
let plansDir: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agentline-session-plan-"));
  env = { CLAUDE_CONFIG_DIR: tmp };
  plansDir = path.join(tmp, "plans");
  mkdirSync(plansDir);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function planFile(name: string): string {
  const file = path.join(plansDir, `${name}.md`);
  writeFileSync(file, "x");
  return file;
}

/** Read `env` lazily — it is (re)assigned per test in `beforeEach`. */
function opts(extra: { clock?: () => Date } = {}): {
  env: NodeJS.ProcessEnv;
  lockTimeoutMs: number;
  clock?: () => Date;
} {
  return { env, lockTimeoutMs: 200, ...extra };
}

describe("resolveSessionPlanPaths", () => {
  it("joins CLAUDE_CONFIG_DIR + state/session-plan.json", () => {
    expect(resolveSessionPlanPaths(env)).toEqual({
      stateDir: path.join(tmp, "state"),
      cacheFile: path.join(tmp, "state", "session-plan.json"),
    });
  });
});

describe("readSessionPlanEntrySync", () => {
  it("returns null when the cache file is absent", () => {
    expect(readSessionPlanEntrySync("s1", env)).toBeNull();
  });

  it("returns null for an undefined session id", () => {
    expect(readSessionPlanEntrySync(undefined, env)).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    mkdirSync(path.join(tmp, "state"));
    writeFileSync(path.join(tmp, "state", "session-plan.json"), "{not json");
    expect(readSessionPlanEntrySync("s1", env)).toBeNull();
  });

  it("returns null on a version mismatch", async () => {
    mkdirSync(path.join(tmp, "state"));
    writeFileSync(
      path.join(tmp, "state", "session-plan.json"),
      JSON.stringify({ version: SESSION_PLAN_CACHE_VERSION + 1, sessions: { s1: {} } }),
    );
    expect(readSessionPlanEntrySync("s1", env)).toBeNull();
  });
});

describe("recordSessionPlan", () => {
  it("round-trips a recorded plan", async () => {
    const file = planFile("alpha");
    await recordSessionPlan("s1", file, "alpha", opts());
    expect(readSessionPlanEntrySync("s1", env)).toMatchObject({
      planFilePath: file,
      name: "alpha",
    });
  });

  it("keeps distinct sessions independent", async () => {
    const a = planFile("alpha");
    const b = planFile("beta");
    await recordSessionPlan("s1", a, "alpha", opts());
    await recordSessionPlan("s2", b, "beta", opts());
    expect(readSessionPlanEntrySync("s1", env)?.name).toBe("alpha");
    expect(readSessionPlanEntrySync("s2", env)?.name).toBe("beta");
  });

  it("skips the write when the stored plan is unchanged", async () => {
    const file = planFile("alpha");
    await recordSessionPlan("s1", file, "alpha", opts({ clock: () => new Date("2020-01-01T00:00:00Z") }));
    const first = readSessionPlanEntrySync("s1", env);
    await recordSessionPlan("s1", file, "alpha", opts({ clock: () => new Date("2021-06-06T00:00:00Z") }));
    const second = readSessionPlanEntrySync("s1", env);
    expect(second?.recordedAt).toBe(first?.recordedAt);
  });

  it("updates the entry when the plan changes", async () => {
    const a = planFile("alpha");
    const b = planFile("beta");
    await recordSessionPlan("s1", a, "alpha", opts());
    await recordSessionPlan("s1", b, "beta", opts());
    expect(readSessionPlanEntrySync("s1", env)).toMatchObject({ planFilePath: b, name: "beta" });
  });

  it("prunes entries whose plan file no longer exists", async () => {
    const a = planFile("alpha");
    const b = planFile("beta");
    await recordSessionPlan("s1", a, "alpha", opts());
    await recordSessionPlan("s2", b, "beta", opts());
    rmSync(b);
    // A fresh write for a third session triggers the prune pass.
    const c = planFile("gamma");
    await recordSessionPlan("s3", c, "gamma", opts());
    expect(readSessionPlanEntrySync("s2", env)).toBeNull();
    expect(readSessionPlanEntrySync("s1", env)?.name).toBe("alpha");
    expect(readSessionPlanEntrySync("s3", env)?.name).toBe("gamma");
  });

  it("is a no-op for an undefined session id", async () => {
    await recordSessionPlan(undefined, planFile("alpha"), "alpha", opts());
    expect(readSessionPlanEntrySync("s1", env)).toBeNull();
  });
});
