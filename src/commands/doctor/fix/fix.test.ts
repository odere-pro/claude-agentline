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
});
