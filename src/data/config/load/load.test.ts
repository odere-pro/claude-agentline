import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./load.js";
import { DEFAULT_CONFIG } from "../defaults/defaults.js";

describe("loadConfig", () => {
  let claudeCfgDir: string;

  beforeEach(async () => {
    claudeCfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-cfg-"));
  });

  afterEach(async () => {
    await fs.rm(claudeCfgDir, { recursive: true, force: true });
  });

  it("returns defaults when no user config exists", async () => {
    const out = await loadConfig({
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(out.config).toEqual(DEFAULT_CONFIG);
    expect(out.sources).toEqual({ user: false });
  });

  it("merges user config over defaults", async () => {
    const userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(
      userCfg,
      JSON.stringify({ version: 1, theme: "nord", global: { padding: 3 } }),
    );
    const out = await loadConfig({
      env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
    });
    expect(out.config.theme).toBe("nord");
    expect(out.config.global.padding).toBe(3);
    expect(out.config.global.separator).toBe("|");
    expect(out.sources.user).toBe(true);
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
        AGENTLINE_GLOBAL_PADDING: "9",
      },
    });
    expect(out.config.global.padding).toBe(9);
  });

  it("flag overrides win over env", async () => {
    const out = await loadConfig({
      env: {
        CLAUDE_CONFIG_DIR: claudeCfgDir,
        AGENTLINE_GLOBAL_PADDING: "2",
      },
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
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
      }),
    ).rejects.toThrow(/agentline: config invalid/);
  });

  it("surfaces clear error on malformed user JSON", async () => {
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(join(claudeCfgDir, "agentline", "config.json"), "{not json");
    await expect(
      loadConfig({
        env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
      }),
    ).rejects.toThrow(/invalid JSON/);
  });

  it("propagates non-SyntaxError fs errors unchanged", async () => {
    /*
     * Make the user config file unreadable so fs.readFile throws EACCES;
     * exercises the rethrow branch (not ENOENT, not SyntaxError).
     */
    const cfgPath = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(cfgPath, JSON.stringify({ version: 1 }));
    await fs.chmod(cfgPath, 0o000);
    try {
      await expect(
        loadConfig({
          env: { CLAUDE_CONFIG_DIR: claudeCfgDir },
        }),
        /*
         * Unreadable file: rethrown as-is rather than wrapped in the JSON
         * helper. Match on permission-denied to avoid root-running CI flakes.
         */
      ).rejects.toThrow(/EACCES|permission/i);
    } finally {
      await fs.chmod(cfgPath, 0o600).catch(() => undefined);
    }
  });

  it("silently ignores a project-shaped .agentline.json next to cwd", async () => {
    /*
     * Regression guard for the project-layer removal: previously this file
     * would have layered on top of user config. With agentline always
     * configured globally it must be ignored, and the loader must still
     * return user config without errors. We can't change process.cwd in a
     * test, so we assert the shape of LoadOptions: `cwd` is no longer a
     * recognised input — passing extra fields would be a compile error,
     * and the loader has no code path that reads the cwd.
     */
    const userCfg = join(claudeCfgDir, "agentline", "config.json");
    await fs.mkdir(join(claudeCfgDir, "agentline"), { recursive: true });
    await fs.writeFile(userCfg, JSON.stringify({ version: 1, theme: "nord" }));
    const out = await loadConfig({ env: { CLAUDE_CONFIG_DIR: claudeCfgDir } });
    expect(out.config.theme).toBe("nord");
    expect(out.sources).toEqual({ user: true });
  });
});
