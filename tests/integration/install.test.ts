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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rmrf } from "../../src/test-helpers/index.js";

/*
 * Each round-trip test drives two real shell scripts back-to-back
 * (install.sh + uninstall.sh), and each script spawns several node
 * subprocesses for the atomic copies/writes. On the Windows CI leg those
 * spawns are slow and the whole file runs ~80s under parallel-file
 * contention, so the global 30s budget in vitest.config.ts is too tight
 * for the two-script tests and they intermittently time out. Give this
 * suite a realistic per-test/hook budget; unit tests keep the strict
 * global default.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

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
  /** npm cache + `_logs`, kept OUTSIDE `root` so the tree snapshot is PM-noise-free. */
  npmCache: string;
  /** Sandbox global npm prefix, kept OUTSIDE `root` for the same reason. */
  npmPrefix: string;
  env: NodeJS.ProcessEnv;
}

async function setupSandbox(): Promise<Sandbox> {
  const root = await fs.mkdtemp(join(tmpdir(), "agentline-it-"));
  const home = join(root, "home");
  const configDir = join(root, "cfg");
  const binDir = join(root, "bin");
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  /*
   * npm writes a timestamped debug log per invocation under `<cache>/_logs`.
   * The shipped scripts probe `npm ls -g`, so without relocating the cache
   * those non-deterministic logs land in HOME (inside `root`) and break the
   * idempotency / no-op snapshots. Keep the cache OUTSIDE `root`.
   */
  const npmCache = await fs.mkdtemp(join(tmpdir(), "agentline-npmc-"));
  /*
   * `uninstall.sh` probes `npm ls -g` and then runs `npm uninstall -g
   * @odere-pro/agentline`. Both resolve against npm's *global prefix*, which
   * HOME does not move. Without pinning `npm_config_prefix` the suite reaches
   * out of its sandbox and uninstalls the developer's own globally-installed
   * agentline — a real, observed side effect of running `pnpm test` on a
   * machine that has the package. Give npm a prefix inside the sandbox.
   */
  const npmPrefix = await fs.mkdtemp(join(tmpdir(), "agentline-npmp-"));
  // Create both global-root layouts (posix `lib/node_modules`, win `node_modules`)
  // so npm finds an existing prefix whichever one it resolves to.
  await fs.mkdir(join(npmPrefix, "lib", "node_modules"), { recursive: true });
  await fs.mkdir(join(npmPrefix, "node_modules"), { recursive: true });
  await fs.mkdir(join(npmPrefix, "bin"), { recursive: true });
  // Drop a no-op `agentline` shim so install.sh skips global npm install.
  const shim = join(binDir, "agentline");
  await fs.writeFile(shim, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
  return {
    root,
    home,
    configDir,
    binDir,
    npmCache,
    npmPrefix,
    env: {
      ...withoutNpmPrefix(process.env),
      HOME: home,
      CLAUDE_CONFIG_DIR: configDir,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      npm_config_cache: npmCache,
      npm_config_prefix: npmPrefix,
      npm_config_update_notifier: "false",
      npm_config_fund: "false",
      npm_config_audit: "false",
    },
  };
}

/**
 * Drop every case-variant of `npm_config_prefix` from an env snapshot.
 *
 * The GitHub Windows runner exports `NPM_CONFIG_PREFIX=C:\npm\prefix`.
 * Spreading `process.env` into a plain object keeps that key *alongside* our
 * lowercase one, and on Windows npm resolves the runner's — so the sandbox
 * silently leaked back onto the real global prefix. Strip, then set one.
 */
function withoutNpmPrefix(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([k]) => !/^npm_config_prefix$/i.test(k)),
  ) as NodeJS.ProcessEnv;
}

/**
 * npm's global package root under `prefix`. The layout differs per platform
 * (`<prefix>/lib/node_modules` vs `<prefix>\node_modules`), so ask npm rather
 * than guess. Run through bash: on Windows `npm` is a `.cmd` shim that
 * `execFile` cannot spawn directly, and bash is what drives the scripts anyway.
 */
async function npmGlobalRoot(env: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileP("bash", ["-c", "npm root -g"], { env });
  return resolve(stdout.trim());
}

/** Seed a stand-in globally-installed `@odere-pro/agentline` in the sandbox prefix. */
async function seedGlobalPackage(sb: Sandbox): Promise<string> {
  const root = await npmGlobalRoot(sb.env);
  /*
   * Hard safety interlock. If npm ignored `npm_config_prefix`, `root` is the
   * REAL global root and seeding there would make this test uninstall the
   * developer's actual agentline — the very bug it exists to prevent.
   */
  if (!root.startsWith(resolve(sb.npmPrefix))) {
    throw new Error(
      `npm did not honour npm_config_prefix: global root ${root} is outside sandbox ${sb.npmPrefix}`,
    );
  }
  const pkgDir = join(root, "@odere-pro", "agentline");
  await fs.mkdir(pkgDir, { recursive: true });
  await fs.writeFile(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: "@odere-pro/agentline", version: "0.0.0-test" }),
  );
  return pkgDir;
}

async function teardown(sb: Sandbox): Promise<void> {
  // `rmrf` retries the Windows `EBUSY` rmdir race the shell scripts'
  // node subprocesses can leave behind; see src/test-helpers/sandbox.
  await Promise.all([rmrf(sb.root), rmrf(sb.npmCache), rmrf(sb.npmPrefix)]);
}

// `execFile`'s own timeout must clear the slow-Windows spawn budget. The
// suite raises testTimeout to 120s (vi.setConfig above) because each script
// spawns several node subprocesses that crawl on the Windows CI leg — but a
// per-call 30s cap here would SIGTERM a legitimately slow uninstall and
// surface only "Command failed" with no stderr. Keep it just under the
// 120s test budget so the test timeout, not this one, is the outer bound.
const SCRIPT_TIMEOUT_MS = 110_000;

async function runScript(script: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string) {
  try {
    return await execFileP("bash", [script, ...args], {
      env,
      timeout: SCRIPT_TIMEOUT_MS,
      ...(cwd !== undefined && { cwd }),
    });
  } catch (err) {
    // execFile hangs stdout/stderr on the error object but leaves them out
    // of the message, which made the Windows failure a black box in CI.
    // Re-throw with the script's own output (and the kill signal, if any).
    const e = err as Error & { stdout?: string; stderr?: string; signal?: string };
    const detail = [
      e.signal ? `signal=${e.signal}` : "",
      e.stdout ? `\n--- stdout ---\n${e.stdout}` : "",
      e.stderr ? `\n--- stderr ---\n${e.stderr}` : "",
    ]
      .filter(Boolean)
      .join("");
    throw new Error(`${e.message}${detail}`);
  }
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
    /*
     * The wired command must be the explicit `render` form so a future
     * top-level subcommand can never mis-dispatch the statusline payload.
     */
    expect(settings.statusLine?.command).toMatch(/\brender\b/);
  });

  const SHIPPED_SKILLS = [
    "agentline.md",
    "agentline-onboarding.md",
    "agentline-configure.md",
    "agentline-themes.md",
    "agentline-troubleshoot.md",
  ] as const;

  it("seeds the shipped skill files into the global agents dir when Claude is installed", async () => {
    // `~/.claude/` present ⇒ Claude Code is installed ⇒ seed the skills.
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });

    await runScript(installSh, [], sb.env, sb.root);

    for (const skill of SHIPPED_SKILLS) {
      expect(await exists(join(sb.home, ".claude", "agents", skill))).toBe(true);
    }
  });

  it("skips skill seeding when Claude is not installed (no ~/.claude/)", async () => {
    // Fresh host: no `~/.claude/` at seed time. The statusLine step later
    // creates `~/.claude/settings.json`, but `seed_skills` ran first and
    // skipped, so the agents dir must never be created.
    await runScript(installSh, [], sb.env, sb.root);

    expect(await exists(join(sb.home, ".claude", "agents"))).toBe(false);
  });

  it("migrates a legacy bare-form `agentline` entry to the explicit `render` form", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    /*
     * Simulate a host wired by an older agentline release: bare path, no
     * `render` subcommand. Re-running install must rewrite this in place.
     */
    const legacy = "/usr/local/bin/agentline";
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { type: "command", command: legacy, padding: 0 } }),
    );

    await runScript(installSh, [], sb.env, sb.root);

    const after = (await readJson(settingsPath)) as { statusLine: { command: string } };
    expect(after.statusLine.command).toMatch(/agentline/);
    expect(after.statusLine.command).toMatch(/\brender\b/);
    /*
     * The migration is recognising our own prior wiring — the backup file
     * must NOT capture the bare-form value as if it were a foreign
     * pre-install statusLine to restore on uninstall.
     */
    const backupPath = join(sb.configDir, "state", "settings-backup.json");
    if (await exists(backupPath)) {
      const backup = (await readJson(backupPath)) as {
        previousStatusLinePresent: boolean;
        previousStatusLine: unknown;
      };
      const captured =
        backup.previousStatusLine &&
        typeof backup.previousStatusLine === "object" &&
        "command" in backup.previousStatusLine
          ? (backup.previousStatusLine as { command: string }).command
          : undefined;
      expect(captured).not.toBe(legacy);
    }
  });

  it("is idempotent — second run yields the same on-disk tree", async () => {
    // Model a Claude-installed host so skill seeding is exercised on both
    // runs (run 1 seeds, run 2 finds them present) — otherwise the first
    // run would create ~/.claude/ via statusLine wiring and flip the skill
    // gate on for the second run, perturbing the tree.
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
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
    const edited = JSON.stringify({
      version: 1,
      theme: "claude-code-dark",
      lines: [{ widgets: [{ type: "model" }] }],
    });
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
    const backup = (await readJson(join(sb.configDir, "state", "settings-backup.json"))) as {
      previousStatusLinePresent: boolean;
      previousStatusLine: { command: string };
    };
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
    const backup = (await readJson(join(sb.configDir, "state", "settings-backup.json"))) as {
      previousStatusLine: { command: string };
    };
    expect(backup.previousStatusLine.command).toBe("starship init bash");
  });

  it("--dry-run touches no files", async () => {
    const before = await snapshotTree(sb.root);
    await runScript(installSh, ["--dry-run"], sb.env, sb.root);
    const after = await snapshotTree(sb.root);
    expect(after).toEqual(before);
  });
});

describe("scripts/install.sh --reset", () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await setupSandbox();
  });
  afterEach(async () => {
    await teardown(sb);
  });

  it("overwrites a user-edited config with the default template", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    const template = join(repoRoot, "templates", "default.config.json");
    await fs.writeFile(
      userCfg,
      JSON.stringify({ version: 1, theme: "claude-code-dark", lines: [] }),
    );

    await runScript(installSh, ["--reset"], sb.env, sb.root);

    const after = await fs.readFile(userCfg, "utf8");
    const expected = await fs.readFile(template, "utf8");
    expect(after).toBe(expected);
  });

  it("--reset --dry-run leaves the edited config untouched", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    const edited = JSON.stringify({ version: 1, theme: "edited-by-user" });
    await fs.writeFile(userCfg, edited);
    const before = await snapshotTree(sb.root);

    await runScript(installSh, ["--reset", "--dry-run"], sb.env, sb.root);

    expect(await snapshotTree(sb.root)).toEqual(before);
    expect(await fs.readFile(userCfg, "utf8")).toBe(edited);
  });

  it("does not clobber the pre-install statusLine backup", async () => {
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    const settingsPath = join(sb.home, ".claude", "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ statusLine: { command: "starship init bash" } }),
    );
    await runScript(installSh, [], sb.env, sb.root); // backs up starship
    await runScript(installSh, ["--reset"], sb.env, sb.root);

    const backup = (await readJson(join(sb.configDir, "state", "settings-backup.json"))) as {
      previousStatusLine: { command: string };
    };
    expect(backup.previousStatusLine.command).toBe("starship init bash");
  });

  it("on a clean host seeds config + themes and wires statusLine", async () => {
    await runScript(installSh, ["--reset"], sb.env, sb.root);

    expect(await exists(join(sb.configDir, "config.json"))).toBe(true);
    expect(await exists(join(sb.configDir, "themes", "claude-code-dark.json"))).toBe(true);
    const settings = (await readJson(join(sb.home, ".claude", "settings.json"))) as {
      statusLine?: { command?: string };
    };
    expect(settings.statusLine?.command).toMatch(/agentline/);
    expect(settings.statusLine?.command).toMatch(/\brender\b/);
  });

  it("is idempotent — second --reset run yields the same on-disk tree", async () => {
    // Claude-installed host (see the install idempotency test) so skill
    // seeding is stable across both runs.
    await fs.mkdir(join(sb.home, ".claude"), { recursive: true });
    await runScript(installSh, ["--reset"], sb.env, sb.root);
    const tree1 = await snapshotTree(sb.root);
    await runScript(installSh, ["--reset"], sb.env, sb.root);
    const tree2 = await snapshotTree(sb.root);
    expect(tree2).toEqual(tree1);
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

  // Drives install.sh + uninstall.sh back-to-back, each spawning several
  // node subprocesses. The raised SCRIPT_TIMEOUT_MS fixes the SIGTERM-at-30s
  // root cause; retry absorbs any residual Windows EBUSY/EPERM teardown race.
  it("install + uninstall round-trip leaves no agentline footprint", { retry: 2 }, async () => {
    await runScript(installSh, [], sb.env, sb.root);
    await runScript(uninstallSh, [], sb.env, sb.root);

    expect(await exists(join(sb.configDir, "config.json"))).toBe(false);
    for (const t of ["claude-code-dark"]) {
      expect(await exists(join(sb.configDir, "themes", `${t}.json`))).toBe(false);
    }
    const settings = (await readJson(join(sb.home, ".claude", "settings.json"))) as Record<
      string,
      unknown
    >;
    expect(settings).not.toHaveProperty("statusLine");
  });

  it("uninstalls the global package only from the sandbox npm prefix", async () => {
    /*
     * Regression guard: `uninstall.sh` resolves `npm ls -g` / `npm uninstall
     * -g` against npm's global prefix, which `HOME` does not relocate. If the
     * sandbox stops pinning `npm_config_prefix`, this seeded package survives
     * (because the script went and uninstalled the *real* one instead).
     */
    const pkgDir = await seedGlobalPackage(sb);
    expect(await exists(pkgDir)).toBe(true);

    await runScript(uninstallSh, [], sb.env, sb.root);

    expect(await exists(pkgDir)).toBe(false);
  });

  it("preserves user-edited config (without --purge)", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    await fs.writeFile(userCfg, JSON.stringify({ version: 1, theme: "claude-code-dark" }));

    await runScript(uninstallSh, [], sb.env, sb.root);
    expect(await exists(userCfg)).toBe(true);
  });

  it("--purge removes user-edited config", async () => {
    await runScript(installSh, [], sb.env, sb.root);
    const userCfg = join(sb.configDir, "config.json");
    await fs.writeFile(userCfg, JSON.stringify({ version: 1, theme: "claude-code-dark" }));

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
    expect(await exists(join(sb.configDir, "state", "settings-backup.json"))).toBe(false);
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
