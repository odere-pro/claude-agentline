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

  it("D07 always returns status: skip", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d07 = results.find((r) => r.id === "D07");
    expect(d07?.status).toBe("skip");
  });

  it("D08 returns pass with message containing 'not set' when CLAUDE_CONFIG_DIR is absent", async () => {
    const results = await runChecks({
      fix: false,
      json: false,
      strict: false,
      home,
      env: {},
      cwd: cfgDir,
    });
    const d08 = results.find((r) => r.id === "D08");
    expect(d08?.status).toBe("pass");
    expect(d08?.message).toMatch(/not set/);
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
