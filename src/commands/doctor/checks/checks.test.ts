import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runChecks } from "./checks.js";

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

  it("D06 passes when the resolved config dir exists and is writable", async () => {
    await fs.mkdir(join(cfgDir, "agentline"), { recursive: true });
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d06 = results.find((r) => r.id === "D06");
    expect(d06?.status).toBe("pass");
    expect(d06?.message).toMatch(/writable/);
  });

  it("D06 passes (creatable) when the config dir is absent but its parent is writable", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d06 = results.find((r) => r.id === "D06");
    expect(d06?.status).toBe("pass");
    expect(d06?.message).toMatch(/does not exist yet; nearest existing parent/);
  });

  it("D07 returns pass with `no cached check yet` when the cache is missing", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d07 = results.find((r) => r.id === "D07");
    expect(d07?.status).toBe("pass");
    expect(d07?.message).toMatch(/no cached check yet/);
    expect(d07?.hint).toMatch(/agentline install/);
  });

  it("D07 reports `update available` when the cache says a newer version exists", async () => {
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
    const d07 = results.find((r) => r.id === "D07");
    expect(d07?.status).toBe("pass");
    expect(d07?.message).toMatch(/update available/);
    expect(d07?.message).toContain("9.9.9");
    expect(d07?.hint).toMatch(/npm i -g @odere-pro\/agentline/);
  });

  it("D07 reports `up to date` when the cached latest equals the current build", async () => {
    const { AGENTLINE_VERSION } = await import("../../../version.js");
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
    const d07 = results.find((r) => r.id === "D07");
    expect(d07?.status).toBe("pass");
    expect(d07?.message).toMatch(/up to date/);
  });

  it("D07 reports `last probe failed` when the cache shows latest: null", async () => {
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
    const d07 = results.find((r) => r.id === "D07");
    expect(d07?.status).toBe("pass");
    expect(d07?.message).toMatch(/last probe failed/);
  });

  it("D02 returns pass when statusLine is a plain string referencing agentline", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: "npx -y @odere-pro/agentline" }),
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
