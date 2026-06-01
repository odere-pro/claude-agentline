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

  const seedClaudeHealth = async (entry: Record<string, unknown>): Promise<void> => {
    await fs.mkdir(join(cfgDir, "state"), { recursive: true });
    await fs.writeFile(
      join(cfgDir, "state", "claude-health.json"),
      JSON.stringify({ version: 1, savedAt: "2026-05-14T00:00:00.000Z", ...entry }),
    );
  };

  const runD10 = async () =>
    (
      await runChecks({
        fix: false,
        json: false,
        strict: false,
        home,
        env: { CLAUDE_CONFIG_DIR: cfgDir },
        cwd: cfgDir,
      })
    ).find((r) => r.id === "D10");

  it("D10 passes with `not detected` when the claude-health cache is missing", async () => {
    const d10 = await runD10();
    expect(d10?.status).toBe("pass");
    expect(d10?.message).toMatch(/not detected/);
  });

  it("D10 reports `update available` when the cache says a newer CLI exists", async () => {
    await seedClaudeHealth({
      cliVersion: "2.0.10",
      latestVersion: "2.0.14",
      needsUpdate: true,
      doctor: { status: "ok", issues: 0, warnings: 0 },
    });
    const d10 = await runD10();
    expect(d10?.status).toBe("pass");
    expect(d10?.message).toMatch(/update available: 2\.0\.10 → 2\.0\.14/);
  });

  it("D10 warns when claude doctor reported warnings", async () => {
    await seedClaudeHealth({
      cliVersion: "2.0.14",
      latestVersion: "2.0.14",
      needsUpdate: false,
      doctor: { status: "warn", issues: 0, warnings: 2 },
    });
    const d10 = await runD10();
    expect(d10?.status).toBe("warn");
    expect(d10?.message).toMatch(/2 warning/);
  });

  it("D10 fails when claude doctor reported issues", async () => {
    await seedClaudeHealth({
      cliVersion: "2.0.14",
      latestVersion: "2.0.14",
      needsUpdate: false,
      doctor: { status: "fail", issues: 1, warnings: 0 },
    });
    const d10 = await runD10();
    expect(d10?.status).toBe("fail");
    expect(d10?.message).toMatch(/1 issue/);
  });

  it("D10 passes `up to date` when the CLI is current and healthy", async () => {
    await seedClaudeHealth({
      cliVersion: "2.0.14",
      latestVersion: "2.0.14",
      needsUpdate: false,
      doctor: { status: "ok", issues: 0, warnings: 0 },
    });
    const d10 = await runD10();
    expect(d10?.status).toBe("pass");
    expect(d10?.message).toMatch(/up to date/);
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
