import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readVersionCheckSync,
  stampNotifyVersion,
} from "../../data/state/version-check-cache/version-check-cache.js";
import { maybeShowUpgradeNotice, ULTRACODE_NOTICE_VERSION } from "./upgrade-notice.js";

let tmpRoot: string;
let env: NodeJS.ProcessEnv;
let out: string[];
const write = (t: string) => out.push(t);

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "agentline-upgrade-notice-"));
  env = { CLAUDE_CONFIG_DIR: tmpRoot };
  out = [];
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("maybeShowUpgradeNotice", () => {
  it("shows the notice on a fresh state dir and stamps lastNotifyVersion", async () => {
    const shown = await maybeShowUpgradeNotice({ env, currentVersion: "1.6.1", write });
    expect(shown).toBe(true);
    expect(out.join("")).toContain("ultracode");
    expect(readVersionCheckSync(env)?.lastNotifyVersion).toBe(ULTRACODE_NOTICE_VERSION);
  });

  it("shows the notice for a pre-1.6.1 stamp, then suppresses on the next run", async () => {
    await stampNotifyVersion("1.6.0", "1.6.0", env);
    expect(await maybeShowUpgradeNotice({ env, currentVersion: "1.6.1", write })).toBe(true);

    out = [];
    expect(await maybeShowUpgradeNotice({ env, currentVersion: "1.6.1", write })).toBe(false);
    expect(out.join("")).toBe("");
  });

  it("does not repeat once the current notice version is stamped", async () => {
    await stampNotifyVersion(ULTRACODE_NOTICE_VERSION, "1.6.1", env);
    expect(await maybeShowUpgradeNotice({ env, currentVersion: "1.6.1", write })).toBe(false);
    expect(out.join("")).toBe("");
  });

  it("does not clobber a real update hint when stamping", async () => {
    // Simulate a prior registry probe that found a newer version.
    const { saveVersionCheck } = await import(
      "../../data/state/version-check-cache/version-check-cache.js"
    );
    await saveVersionCheck(
      { savedAt: "2026-05-14T00:00:00.000Z", current: "1.6.1", latest: "1.7.0" },
      env,
    );
    await maybeShowUpgradeNotice({ env, currentVersion: "1.6.1", write });
    expect(readVersionCheckSync(env)?.latest).toBe("1.7.0");
    expect(readVersionCheckSync(env)?.lastNotifyVersion).toBe(ULTRACODE_NOTICE_VERSION);
  });
});
