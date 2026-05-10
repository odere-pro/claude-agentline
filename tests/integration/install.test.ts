/**
 * Integration tests for `scripts/install.sh` and `scripts/uninstall.sh`.
 *
 * The scripts shell out to `npm install -g` when no `agentline` is on
 * PATH; tests SHOULD NEVER hit the network. We sidestep that by dropping
 * a `agentline` shim into a sandbox PATH so the install path skips the
 * global install step. The settings/config/themes file work, the
 * statusLine wiring, and the uninstall round-trip all run for real
 * against a temp `HOME` and temp `CLAUDE_CONFIG_DIR`.
 *
 * These tests are the first line of defence for gates 07 / 08 / 09 / 10
 * (roundtrip clean, roundtrip preserves user data, install-twice
 * idempotent, dry-run parity) until those gate scripts ship.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const repoRoot = (() => {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
})();
const installSh = join(repoRoot, "scripts", "install.sh");
const uninstallSh = join(repoRoot, "scripts", "uninstall.sh");

interface Sandbox {
  root: string;
  home: string;
  configDir: string;
  binDir: string;
  env: NodeJS.ProcessEnv;
}

async function setupSandbox(): Promise<Sandbox> {
  const root = await fs.mkdtemp(join(tmpdir(), "agentline-it-"));
  const home = join(root, "home");
  const configDir = join(root, "cfg");
  const binDir = join(root, "bin");
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  // Drop a no-op `agentline` shim so install.sh skips global npm install.
  const shim = join(binDir, "agentline");
  await fs.writeFile(shim, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
  return {
    root,
    home,
    configDir,
    binDir,
    env: {
      ...process.env,
      HOME: home,
      CLAUDE_CONFIG_DIR: configDir,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
  };
}

async function teardown(sb: Sandbox): Promise<void> {
  await fs.rm(sb.root, { recursive: true, force: true });
}

async function runScript(script: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string) {
  return execFileP("bash", [script, ...args], { env, timeout: 30000, ...(cwd !== undefined && { cwd }) });
}

async function readJson(path: string): Promise<unknown> {
  const text = await fs.readFile(path, "utf8");
  return JSON.parse(text);
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function snapshotTree(root: string): Promise<string[]> {
  // Deterministic, sorted, relative file list for byte-by-byte diffs.
  const out: string[] = [];
  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs, rel);
      } else {
        out.push(rel);
      }
    }
  }
  if (await exists(root)) await walk(root, "");
  return out;
}

describe("scripts/install.sh", () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await setupSandbox();
  });
  afterEach(async () => {
    await teardown(sb);
  });

  it("seeds config, themes, and wires statusLine on a fresh host", async () => {
    await runScript(installSh, [], sb.env, sb.root);

    expect(await exists(join(sb.configDir, "config.json"))).toBe(true);
    expect(await exists(join(sb.configDir, "themes", "claude-code-dark.json"))).toBe(true);
    expect(await exists(join(sb.home, ".claude", "settings.json"))).toBe(true);

    const settings = (await readJson(join(sb.home, ".claude", "settings.json"))) as {
      statusLine?: { command?: string };
    };
    expect(settings.statusLine?.command).toMatch(/agentline/);
  });

  it("is idempotent — second run yields the same on-disk tree", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const tree1 = await snapshotTree(sb.root);
    const settings1 = await fs.readFile(join(sb.home, ".claude", "settings.json"), "utf8");

    await runScript(installSh, [], sb.env, sb.root);
    const tree2 = await snapshotTree(sb.root);
    const settings2 = await fs.readFile(join(sb.home, ".claude", "settings.json"), "utf8");

    expect(tree2).toEqual(tree1);
    expect(settings2).toBe(settings1);
  });

  it("preserves a user-edited config on re-run", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    const edited = JSON.stringify({ version: 1, theme: "vscode-light", lines: [{ widgets: [{ type: "model" }] }] });
    await fs.writeFile(userCfg, edited);

    await runScript(installSh, [], sb.env, sb.root);
    const after = await fs.readFile(userCfg, "utf8");
    expect(after).toBe(edited);
  });

  it("install backs up a foreign statusLine and overwrites with agentline", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );

    await runScript(installSh, [], sb.env, sb.root);
    const after = (await readJson(settingsPath)) as { statusLine: { command: string } };
    expect(after.statusLine.command).toMatch(/agentline/);
    const backup = (await readJson(
      join(sb.configDir, "state", "settings-backup.json"),
    )) as { previousStatusLinePresent: boolean; previousStatusLine: { command: string } };
    expect(backup.previousStatusLinePresent).toBe(true);
    expect(backup.previousStatusLine.command).toBe("starship init bash");
  });

  it("--force still works (kept for back-compat); behaviour matches default", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );

    await runScript(installSh, ["--force"], sb.env, sb.root);
    const after = (await readJson(settingsPath)) as { statusLine: { command: string } };
    expect(after.statusLine.command).toMatch(/agentline/);
  });

  it("re-running install does NOT clobber the original backup", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );
    await runScript(installSh, [], sb.env, sb.root); // backs up starship
    await runScript(installSh, [], sb.env, sb.root); // settings.json now has agentline
    const backup = (await readJson(
      join(sb.configDir, "state", "settings-backup.json"),
    )) as { previousStatusLine: { command: string } };
    expect(backup.previousStatusLine.command).toBe("starship init bash");
  });

  it("--dry-run touches no files", async () => {
    const before = await snapshotTree(sb.root);
    await runScript(installSh, ["--dry-run"], sb.env, sb.root);
    const after = await snapshotTree(sb.root);
    expect(after).toEqual(before);
  });
});

describe("scripts/uninstall.sh", () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await setupSandbox();
  });
  afterEach(async () => {
    await teardown(sb);
  });

  it("install + uninstall round-trip leaves no agentline footprint", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    await runScript(uninstallSh, [], sb.env, sb.root);

    expect(await exists(join(sb.configDir, "config.json"))).toBe(false);
    for (const t of ["claude-code-dark", "claude-code-light", "vscode-dark", "vscode-light"]) {
      expect(await exists(join(sb.configDir, "themes", `${t}.json`))).toBe(false);
    }
    const settings = (await readJson(join(sb.home, ".claude", "settings.json"))) as Record<
      string,
      unknown
    >;
    expect(settings).not.toHaveProperty("statusLine");
  });

  it("preserves user-edited config (without --purge)", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    await fs.writeFile(userCfg, JSON.stringify({ version: 1, theme: "vscode-light" }));

    await runScript(uninstallSh, [], sb.env, sb.root);
    expect(await exists(userCfg)).toBe(true);
  });

  it("--purge removes user-edited config", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    await fs.writeFile(userCfg, JSON.stringify({ version: 1, theme: "vscode-light" }));

    await runScript(uninstallSh, ["--purge"], sb.env, sb.root);
    expect(await exists(userCfg)).toBe(false);
  });

  it("leaves a foreign statusLine untouched when no backup exists", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );

    await runScript(uninstallSh, [], sb.env, sb.root);
    const after = (await readJson(settingsPath)) as { statusLine: { command: string } };
    expect(after.statusLine.command).toBe("starship init bash");
  });

  it("install + uninstall round-trip restores a foreign statusLine from the backup", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );
    await runScript(installSh, [], sb.env, sb.root); // overwrite + back up
    await runScript(uninstallSh, [], sb.env, sb.root); // restore from backup
    const after = (await readJson(settingsPath)) as { statusLine: { command: string } };
    expect(after.statusLine.command).toBe("starship init bash");
    expect(
      await exists(join(sb.configDir, "state", "settings-backup.json")),
    ).toBe(false);
  });

  it("install with no prior statusLine + uninstall removes the key entirely", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(settingsPath, JSON.stringify({ otherSetting: 1 }));
    await runScript(installSh, [], sb.env, sb.root);
    await runScript(uninstallSh, [], sb.env, sb.root);
    const after = (await readJson(settingsPath)) as Record<string, unknown>;
    expect(after).not.toHaveProperty("statusLine");
    expect(after.otherSetting).toBe(1);
  });

  it("is idempotent — running twice on a clean tree is a no-op", async () => {
    await runScript(uninstallSh, [], sb.env, sb.root);
    const tree1 = await snapshotTree(sb.root);
    await runScript(uninstallSh, [], sb.env, sb.root);
    const tree2 = await snapshotTree(sb.root);
    expect(tree2).toEqual(tree1);
  });

  it("--dry-run after install touches no files", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const before = await snapshotTree(sb.root);
    await runScript(uninstallSh, ["--dry-run"], sb.env, sb.root);
    const after = await snapshotTree(sb.root);
    expect(after).toEqual(before);
  });
});
