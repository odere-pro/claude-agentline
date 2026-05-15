import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyFixes } from "./fix.js";
import type { CheckResult } from "./types.js";

describe("applyFixes", () => {
  let home: string;
  let cfgDir: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(join(tmpdir(), "agentline-fix-home-"));
    cfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-fix-cfg-"));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(cfgDir, { recursive: true, force: true });
  });

  it("passes through results with status: pass unchanged", async () => {
    const results: CheckResult[] = [{ id: "D03", title: "Title", status: "pass", message: "ok" }];
    const out = await applyFixes(results, { home, env: {} });
    expect(out[0]?.status).toBe("pass");
  });

  it("passes through results with status: skip unchanged", async () => {
    const results: CheckResult[] = [
      { id: "D07", title: "Title", status: "skip", message: "skipped" },
    ];
    const out = await applyFixes(results, { home, env: {} });
    expect(out[0]?.status).toBe("skip");
  });

  it("D01 fix creates .claude/settings.json and returns status: fixed", async () => {
    const results: CheckResult[] = [
      { id: "D01", title: "Claude Code settings file present", status: "warn", message: "missing" },
    ];
    const out = await applyFixes(results, { home, env: {} });
    expect(out[0]?.status).toBe("fixed");
    const text = await fs.readFile(join(home, ".claude", "settings.json"), "utf8");
    expect(JSON.parse(text)).toEqual({});
  });

  it("D02 fix writes statusLine referencing agentline", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(join(home, ".claude", "settings.json"), "{}");
    const results: CheckResult[] = [
      { id: "D02", title: "statusLine wired", status: "warn", message: "missing statusLine" },
    ];
    const out = await applyFixes(results, { home, env: { CLAUDE_CONFIG_DIR: cfgDir } });
    expect(out[0]?.status).toBe("fixed");
    expect(out[0]?.message).toMatch(/agentline/);
  });

  it("D04 fix downgrades to warn (bundled themes not present)", async () => {
    const results: CheckResult[] = [
      {
        id: "D04",
        title: "Referenced themes installed",
        status: "warn",
        message: "missing themes: my-theme",
      },
    ];
    const out = await applyFixes(results, { home, env: {} });
    expect(out[0]?.status).toBe("warn");
  });

  it("D05 fix short-circuits to fixed when a Nerd Font is already installed", async () => {
    const results: CheckResult[] = [
      { id: "D05", title: "Nerd Font present", status: "warn", message: "no Nerd Font" },
    ];
    const out = await applyFixes(results, {
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      detectNerdFont: () => true,
      // `fontInstaller` should never be called on the already-installed path.
      fontInstaller: async () => {
        throw new Error("must not download when font is already present");
      },
    });
    expect(out[0]?.status).toBe("fixed");
    expect(out[0]?.message).toMatch(/already installed/);
  });

  it("D05 fix downloads + installs and returns fixed when detection then succeeds", async () => {
    const results: CheckResult[] = [
      { id: "D05", title: "Nerd Font present", status: "warn", message: "no Nerd Font" },
    ];
    let detectCalls = 0;
    const out = await applyFixes(results, {
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir, HOME: home },
      detectNerdFont: () => {
        detectCalls += 1;
        return detectCalls > 1; // first call (pre-install) false, second (post-install) true
      },
      fontInstaller: async () => ({ installed: ["JetBrainsMonoNerdFont-Regular.ttf"] }),
    });
    expect(out[0]?.status).toBe("fixed");
    expect(out[0]?.message).toMatch(/JetBrainsMono Nerd Font/);
  });

  it("D05 fix downgrades to warn when the network is unreachable", async () => {
    const results: CheckResult[] = [
      { id: "D05", title: "Nerd Font present", status: "warn", message: "no Nerd Font" },
    ];
    const out = await applyFixes(results, {
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir, HOME: home },
      detectNerdFont: () => false,
      fontInstaller: async () => ({ error: "ENETUNREACH" }),
    });
    expect(out[0]?.status).toBe("warn");
    expect(out[0]?.message).toMatch(/ENETUNREACH/);
    expect(out[0]?.hint).toMatch(/nerdfonts\.com/);
  });

  it("D05 fix downgrades to warn when install succeeds but detection still reports absent", async () => {
    const results: CheckResult[] = [
      { id: "D05", title: "Nerd Font present", status: "warn", message: "no Nerd Font" },
    ];
    const out = await applyFixes(results, {
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir, HOME: home },
      detectNerdFont: () => false, // never reports present, even after install
      fontInstaller: async () => ({ installed: ["JetBrainsMonoNerdFont-Regular.ttf"] }),
    });
    expect(out[0]?.status).toBe("warn");
    expect(out[0]?.message).toMatch(/terminal may need restart/);
  });

  it("unrecognised warn result passes through unchanged", async () => {
    const results: CheckResult[] = [
      { id: "D99", title: "Unknown check", status: "warn", message: "something" },
    ];
    const out = await applyFixes(results, { home, env: {} });
    expect(out[0]?.status).toBe("warn");
    expect(out[0]?.id).toBe("D99");
  });
});
