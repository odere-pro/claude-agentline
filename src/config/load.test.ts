import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./load.js";
import { DEFAULT_CONFIG } from "./defaults.js";

describe("loadConfig", () => {
  let claudeCfgDir: string;
  let projectDir: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-cfg-"));
    projectDir = await fs.mkdtemp(join(tmpdir(), "agentline-proj-"));
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it("returns defaults when no user/project config exists", async () => {
    const out = await loadConfig({
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir, CLAUDE_PROJECT_DIR: projectDir },
      cwd: projectDir,
    });
    expect(out.config).toEqual(DEFAULT_CONFIG);
    expect(out.sources).toEqual({ user: false, project: false });
  });

  it("merges user config over defaults", async () => {
    const userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({ version: 1, theme: "nord", global: { padding: 3 } }),
    );
    const out = await loadConfig({
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir, CLAUDE_PROJECT_DIR: projectDir },
      cwd: projectDir,
    });
    expect(out.config.theme).toBe("nord");
    expect(out.config.global.padding).toBe(3);
    expect(out.config.global.separator).toBe("|");
    expect(out.sources.user).toBe(true);
  });

  it("project config overrides user config", async () => {
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      join(claudeCfgDir, "agentline", "config.json"),
      JSON.stringify({ version: 1, theme: "nord" }),
    );
    await fs.writeFile(
      join(projectDir, ".agentline.json"),
      JSON.stringify({ version: 1, theme: "dracula" }),
    );
    const out = await loadConfig({
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir, CLAUDE_PROJECT_DIR: projectDir },
      cwd: projectDir,
    });
    expect(out.config.theme).toBe("dracula");
    expect(out.sources).toEqual({ user: true, project: true });
  });

  it("env vars override file layers", async () => {
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      join(claudeCfgDir, "agentline", "config.json"),
      JSON.stringify({ version: 1, global: { padding: 1 } }),
    );
    const out = await loadConfig({
      env: {
        CLAUDE_CONFIG_DIR: claudeCfgDir,
        CLAUDE_PROJECT_DIR: projectDir,
        AGENTLINE_GLOBAL_PADDING: "9",
      },
      cwd: projectDir,
    });
    expect(out.config.global.padding).toBe(9);
  });

  it("flag overrides win over env", async () => {
    const out = await loadConfig({
      env: {
        CLAUDE_CONFIG_DIR: claudeCfgDir,
        CLAUDE_PROJECT_DIR: projectDir,
        AGENTLINE_GLOBAL_PADDING: "2",
      },
      cwd: projectDir,
      flagOverrides: { global: { padding: 7 } },
    });
    expect(out.config.global.padding).toBe(7);
  });

  it("rejects invalid merged config", async () => {
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      join(claudeCfgDir, "agentline", "config.json"),
      JSON.stringify({ version: 1, lines: [{ widgets: [{ type: "model", fg: "neon" }] }] }),
    );
    await expect(
      loadConfig({
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir, CLAUDE_PROJECT_DIR: projectDir },
        cwd: projectDir,
      }),
    ).rejects.toThrow(/agentline: config invalid/);
  });

  it("surfaces clear error on malformed user JSON", async () => {
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(join(claudeCfgDir, "agentline", "config.json"), "{not json");
    await expect(
      loadConfig({
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir, CLAUDE_PROJECT_DIR: projectDir },
        cwd: projectDir,
      }),
    ).rejects.toThrow(/invalid JSON/);
  });
});
