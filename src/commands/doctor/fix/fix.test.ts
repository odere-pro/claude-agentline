import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyFixes } from "./fix.js";
import type { CheckResult } from "../types.js";

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
      { id: "D99", title: "Title", status: "skip", message: "skipped" },
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

  it("unrecognised warn result passes through unchanged", async () => {
    const results: CheckResult[] = [
      { id: "D99", title: "Unknown check", status: "warn", message: "something" },
    ];
    const out = await applyFixes(results, { home, env: {} });
    expect(out[0]?.status).toBe("warn");
    expect(out[0]?.id).toBe("D99");
  });

  it("does not throw when config.json is corrupt and D01+D02+D03 all need fixing", async () => {
    // Corrupt config.json on disk
    await fs.mkdir(join(cfgDir, "agentline"), { recursive: true });
    await fs.writeFile(join(cfgDir, "agentline", "config.json"), "{ INVALID JSON !!!");

    // D01 settings.json missing (home has no .claude/ dir)
    // D02 statusLine not wired
    // D03 config schema fail
    const results: CheckResult[] = [
      {
        id: "D01",
        title: "Claude Code settings file present",
        status: "warn",
        message: "missing",
      },
      { id: "D02", title: "statusLine wired", status: "warn", message: "missing statusLine" },
      { id: "D03", title: "Config schema valid", status: "fail", message: "invalid JSON" },
    ];

    // Must NOT throw even though loadConfig would throw on the corrupt config
    const out = await applyFixes(results, { home, env: { CLAUDE_CONFIG_DIR: cfgDir } });

    // All three fixable checks must reach a terminal fixed/warn state (not throw)
    const d01 = out.find((r) => r.id === "D01");
    const d02 = out.find((r) => r.id === "D02");
    const d03 = out.find((r) => r.id === "D03");

    expect(d01?.status).toBe("fixed");
    expect(d02?.status).toBe("fixed");
    expect(d03?.status).toBe("fixed");

    // After fix the config.json must be valid JSON containing DEFAULT_CONFIG shape
    const text = await fs.readFile(join(cfgDir, "agentline", "config.json"), "utf8");
    const parsed = JSON.parse(text) as { version?: number; refreshInterval?: number };
    expect(parsed.version).toBe(1);
  });

  it("does not throw in fixD09 when config.json is corrupt (guard path)", async () => {
    // Corrupt config.json on disk
    await fs.mkdir(join(cfgDir, "agentline"), { recursive: true });
    await fs.writeFile(join(cfgDir, "agentline", "config.json"), "{ BAD }");

    // Settings.json wired so D09 fix path is reachable
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({
        statusLine: { type: "command", command: "npx -y @odere-pro/agentline render" },
      }),
    );

    const results: CheckResult[] = [
      { id: "D09", title: "refreshInterval in sync", status: "warn", message: "out of sync" },
    ];

    // Must NOT throw
    const out = await applyFixes(results, { home, env: { CLAUDE_CONFIG_DIR: cfgDir } });
    const d09 = out.find((r) => r.id === "D09");
    // Should resolve to fixed or warn (not throw / exit 2)
    expect(["fixed", "warn"]).toContain(d09?.status);
  });
});
