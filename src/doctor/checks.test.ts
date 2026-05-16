import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluatePricingFreshness, runChecks } from "./checks.js";
import { PRICING_TABLE_VERSION } from "../tokens/pricing.js";

describe("runChecks", () => {
  let home: string;
  let cfgDir: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(join(tmpdir(), "agentline-checks-home-"));
    cfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-checks-cfg-"));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(cfgDir, { recursive: true, force: true });
  });

  it("D06 reports a pass-or-warn verdict referencing the embedded pricing version", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d06 = results.find((r) => r.id === "D06");
    expect(d06).toBeDefined();
    expect(["pass", "warn"]).toContain(d06?.status);
    expect(d06?.message).toContain(PRICING_TABLE_VERSION);
  });

  it("D07 returns pass with message containing 'not set' when CLAUDE_CONFIG_DIR is absent", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: {},
      cwd: cfgDir,
    });
    const d07 = results.find((r) => r.id === "D07");
    expect(d07?.status).toBe("pass");
    expect(d07?.message).toMatch(/not set/);
  });

  it("D08 returns pass with `no cached check yet` when the cache is missing", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d08 = results.find((r) => r.id === "D08");
    expect(d08?.status).toBe("pass");
    expect(d08?.message).toMatch(/no cached check yet/);
    expect(d08?.hint).toMatch(/agentline install/);
  });

  it("D08 reports `update available` when the cache says a newer version exists", async () => {
    await fs.mkdir(join(cfgDir, "state"), { recursive: true });
    await fs.writeFile(
      join(cfgDir, "state", "version-check.json"),
      JSON.stringify({
        version: 1,
        savedAt: "2026-05-14T00:00:00.000Z",
        current: "0.1.0",
        latest: "9.9.9",
      }),
    );
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d08 = results.find((r) => r.id === "D08");
    expect(d08?.status).toBe("pass");
    expect(d08?.message).toMatch(/update available/);
    expect(d08?.message).toContain("9.9.9");
    expect(d08?.hint).toMatch(/npm i -g @agentline\/cli/);
  });

  it("D08 reports `up to date` when the cached latest equals the current build", async () => {
    const { AGENTLINE_VERSION } = await import("../version.js");
    await fs.mkdir(join(cfgDir, "state"), { recursive: true });
    await fs.writeFile(
      join(cfgDir, "state", "version-check.json"),
      JSON.stringify({
        version: 1,
        savedAt: "2026-05-14T00:00:00.000Z",
        current: AGENTLINE_VERSION,
        latest: AGENTLINE_VERSION,
      }),
    );
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d08 = results.find((r) => r.id === "D08");
    expect(d08?.status).toBe("pass");
    expect(d08?.message).toMatch(/up to date/);
  });

  it("D08 reports `last probe failed` when the cache shows latest: null", async () => {
    await fs.mkdir(join(cfgDir, "state"), { recursive: true });
    await fs.writeFile(
      join(cfgDir, "state", "version-check.json"),
      JSON.stringify({
        version: 1,
        savedAt: "2026-05-14T00:00:00.000Z",
        current: "0.1.0",
        latest: null,
      }),
    );
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d08 = results.find((r) => r.id === "D08");
    expect(d08?.status).toBe("pass");
    expect(d08?.message).toMatch(/last probe failed/);
  });

  it("D02 returns pass when statusLine is a plain string referencing agentline", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: "npx -y @agentline/cli" }),
    );
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d02 = results.find((r) => r.id === "D02");
    expect(d02?.status).toBe("pass");
  });
});

describe("evaluatePricingFreshness", () => {
  it("returns pass when the version is within 90 days of now", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const verdict = evaluatePricingFreshness("2026-04-20", now);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("2026-04-20");
    expect(verdict.message).toContain("24d old");
    expect(verdict.hint).toBeUndefined();
  });

  it("returns pass exactly on the 90-day boundary", () => {
    const now = new Date("2026-05-14T00:00:00Z");
    const versionDate = new Date(now.getTime() - 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const verdict = evaluatePricingFreshness(versionDate, now);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("90d old");
  });

  it("returns warn when the version is older than 90 days", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const verdict = evaluatePricingFreshness("2026-01-01", now);
    expect(verdict.status).toBe("warn");
    expect(verdict.message).toContain("2026-01-01");
    expect(verdict.message).toMatch(/133d old/);
    expect(verdict.message).toContain("threshold 90");
    expect(verdict.hint).toMatch(/PRICING_TABLE_VERSION/);
  });

  it("treats future-dated versions as fresh and reports zero age", () => {
    const now = new Date("2026-05-14T12:00:00Z");
    const verdict = evaluatePricingFreshness("2027-01-01", now);
    expect(verdict.status).toBe("pass");
    expect(verdict.message).toContain("0d old");
  });

  it("returns warn with a parse-error message for a malformed version string", () => {
    const verdict = evaluatePricingFreshness("not-a-date", new Date("2026-05-14T12:00:00Z"));
    expect(verdict.status).toBe("warn");
    expect(verdict.message).toContain('PRICING_TABLE_VERSION="not-a-date"');
    expect(verdict.hint).toMatch(/src\/tokens\/pricing\.ts/);
  });

  it("rejects calendar-invalid dates that match the YYYY-MM-DD shape", () => {
    const verdict = evaluatePricingFreshness("2026-13-40", new Date("2026-05-14T12:00:00Z"));
    expect(verdict.status).toBe("warn");
    expect(verdict.message).toContain("2026-13-40");
  });
});
