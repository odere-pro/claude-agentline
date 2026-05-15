import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "./run.js";

describe("runDoctor", () => {
  let home: string;
  let cfgDir: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(join(tmpdir(), "agentline-home-"));
    cfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-cfg-"));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(cfgDir, { recursive: true, force: true });
  });

  it("reports D01 as warn on a fresh host (no settings.json)", async () => {
    const { report, exitCode } = await runDoctor({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d01 = report.results.find((r) => r.id === "D01");
    expect(d01?.status).toBe("warn");
    expect(exitCode).toBe(0); // strict not set
  });

  it("returns exit 0 by default even when warnings exist", async () => {
    const { exitCode } = await runDoctor({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    expect(exitCode).toBe(0);
  });

  it("returns exit 3 in --strict mode when warnings exist", async () => {
    const { exitCode } = await runDoctor({
      fix: false,
      json: false,
      strict: true,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    expect(exitCode).toBe(3);
  });

  it("--fix repairs D01 by creating the Claude Code settings file (and chains into D02)", async () => {
    const { report } = await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d01 = report.results.find((r) => r.id === "D01");
    expect(d01?.status).toBe("fixed");
    // D02 runs after D01 in the same pass and writes statusLine into the
    // freshly-created file — that's expected; the file must exist and be
    // valid JSON.
    const text = await fs.readFile(join(home, ".claude", "settings.json"), "utf8");
    const parsed = JSON.parse(text);
    expect(parsed).toBeTypeOf("object");
    expect(parsed.statusLine.command).toMatch(/agentline/);
  });

  it("--fix is idempotent on a healthy host", async () => {
    await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const after1 = await fs.readFile(join(home, ".claude", "settings.json"), "utf8");
    const stat1 = await fs.stat(join(home, ".claude", "settings.json"));

    const second = await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const after2 = await fs.readFile(join(home, ".claude", "settings.json"), "utf8");
    const stat2 = await fs.stat(join(home, ".claude", "settings.json"));

    expect(after2).toBe(after1);
    expect(stat2.size).toBe(stat1.size);
    // After both fixes the merged report should report D01/D02 as fixed (not warn).
    const d02 = second.report.results.find((r) => r.id === "D02");
    expect(["fixed", "pass"]).toContain(d02?.status);
  });

  it("--fix wires statusLine when settings is empty", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(join(home, ".claude", "settings.json"), "{}");
    const { report } = await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d02 = report.results.find((r) => r.id === "D02");
    expect(d02?.status).toBe("fixed");
    const settings = JSON.parse(
      await fs.readFile(join(home, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.statusLine.command).toMatch(/agentline/);
  });

  it("--fix overwrites a foreign statusLine and backs up the prior value", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );
    const { report } = await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d02 = report.results.find((r) => r.id === "D02");
    expect(d02?.status).toBe("fixed");
    expect(d02?.message).toMatch(/backed up/);
    const settings = JSON.parse(
      await fs.readFile(join(home, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.statusLine.command).toMatch(/agentline/);
    const backup = JSON.parse(
      await fs.readFile(
        join(cfgDir, "state", "settings-backup.json"),
        "utf8",
      ),
    );
    expect(backup.previousStatusLinePresent).toBe(true);
    expect(backup.previousStatusLine).toEqual({ command: "starship init bash" });
  });

  it("--fix re-run does NOT clobber the original backup with agentline's own value", async () => {
    await fs.mkdir(join(home, ".claude"), { recursive: true });
    await fs.writeFile(
      join(home, ".claude", "settings.json"),
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );
    // First run: backs up starship.
    await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    // Second run: settings.json now points at agentline. The backup MUST
    // still hold starship — first install wins.
    await runDoctor({
      fix: true,
      // Short-circuit D05 — these tests don't exercise font install.
      detectNerdFont: () => true,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const backup = JSON.parse(
      await fs.readFile(
        join(cfgDir, "state", "settings-backup.json"),
        "utf8",
      ),
    );
    expect(backup.previousStatusLine).toEqual({ command: "starship init bash" });
  });

  it("D10 render fixture passes against the embedded snapshot", async () => {
    const { report } = await runDoctor({
      fix: false,
      json: false,
      strict: false,
      home,
      env: { CLAUDE_CONFIG_DIR: cfgDir },
      cwd: cfgDir,
    });
    const d10 = report.results.find((r) => r.id === "D10");
    expect(d10?.status).toBe("pass");
  });
});
