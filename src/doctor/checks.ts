/**
 * Implementations of the eight doctor checks (D01–D08).
 *
 * Reporting and repair are split: a check NEVER mutates the host;
 * `--fix` calls the matching `fixD0N` helper in `fix.ts` separately
 * (D01–D04 have fixers; D05–D08 are reporting-only).
 *
 * On a missing-but-expected file (e.g. no themes directory when no
 * theme is referenced) the check returns `pass` with an explanatory
 * message — there is nothing wrong with the host in that scenario.
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig, type AgentlineConfig } from "../config/index.js";
import { resolveConfigPaths } from "../config/paths.js";
import { resolveEnv } from "../lib/env.js";
import { pathExists } from "../lib/fs.js";
import { isPlainObject } from "../lib/object.js";
import { readVersionCheckSync } from "../state/version-check-cache.js";
import { isNewer } from "../update-check/refresh.js";
import { AGENTLINE_VERSION } from "../version.js";
import { runEmbeddedRenderFixture } from "./fixture.js";
import type { CheckResult, RunOptions } from "./types.js";

const execFileP = promisify(execFile);

const EXEC_TIMEOUTS = {
  gitVersion: 2000,
} as const;

interface CheckCtx {
  home: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Lazily resolved merged config; some checks need it (D03, D04, D05). */
  config: AgentlineConfig | null;
  /** Loader error if config could not be loaded — used by D03. */
  configError: Error | null;
}

export async function runChecks(opts: RunOptions): Promise<CheckResult[]> {
  const ctx: CheckCtx = {
    home: opts.home ?? homedir(),
    env: resolveEnv(opts),
    cwd: opts.cwd ?? process.cwd(),
    config: null,
    configError: null,
  };
  try {
    const loaded = await loadConfig({ env: ctx.env });
    ctx.config = loaded.config;
  } catch (err) {
    ctx.configError = err as Error;
  }

  return [
    await checkD01(ctx),
    await checkD02(ctx),
    await checkD03(ctx),
    await checkD04(ctx),
    await checkD05(ctx),
    await checkD06(ctx),
    await checkD07(ctx),
    await checkD08(ctx),
  ];
}

/** D01 — Claude Code settings file (under the user's home `.claude` dir) exists. */
async function checkD01(ctx: CheckCtx): Promise<CheckResult> {
  const settings = settingsPath(ctx.home);
  if (await pathExists(settings)) {
    return ok("D01", "Claude Code settings file present", `found ${settings}`);
  }
  return {
    id: "D01",
    title: "Claude Code settings file present",
    status: "warn",
    message: `${settings} is missing`,
    hint: "run `agentline doctor --fix` to scaffold an empty settings file",
  };
}

/** D02 — `statusLine.command` resolves to a working `agentline` invocation. */
async function checkD02(ctx: CheckCtx): Promise<CheckResult> {
  const settings = settingsPath(ctx.home);
  const parsed = await readJsonOrNull(settings);
  if (!isPlainObject(parsed)) {
    return {
      id: "D02",
      title: "statusLine wired to agentline",
      status: "warn",
      message:
        parsed === null
          ? "Claude Code settings file is missing or unreadable"
          : "Claude Code settings file is not a JSON object",
      hint: "fix D01 first, then run `agentline doctor --fix`",
    };
  }
  const sl = parsed["statusLine"];
  if (sl === undefined || sl === null) {
    return {
      id: "D02",
      title: "statusLine wired to agentline",
      status: "warn",
      message: "settings.json has no `statusLine` entry",
      hint: "run `agentline doctor --fix` to wire `npx -y @agentline/cli render`",
    };
  }
  const cmd = extractStatusLineCommand(sl);
  if (!cmd) {
    return {
      id: "D02",
      title: "statusLine wired to agentline",
      status: "warn",
      message: "`statusLine.command` is missing or not a string",
      hint: "run `agentline doctor --fix` to overwrite with a working invocation",
    };
  }
  if (!/agentline/.test(cmd)) {
    return {
      id: "D02",
      title: "statusLine wired to agentline",
      status: "warn",
      message: `\`statusLine.command\` does not reference agentline (${cmd})`,
      hint: "another statusline tool is wired up; --fix will not overwrite without --force",
    };
  }
  return ok("D02", "statusLine wired to agentline", `command: ${cmd}`);
}

/** D03 — User config exists and matches schema. */
async function checkD03(ctx: CheckCtx): Promise<CheckResult> {
  if (ctx.configError) {
    return {
      id: "D03",
      title: "User config matches schema",
      status: "fail",
      message: ctx.configError.message.split("\n")[0] ?? "config invalid",
      hint: "edit the offending file or run `agentline doctor --fix` to write defaults",
    };
  }
  return ok("D03", "User config matches schema", "merged config validated");
}

/** D04 — All themes referenced by config are installed. */
async function checkD04(ctx: CheckCtx): Promise<CheckResult> {
  const wanted = collectReferencedThemes(ctx.config);
  if (wanted.length === 0) {
    return ok("D04", "Referenced themes installed", "no theme referenced");
  }
  const themesDir = join(resolveConfigPaths(ctx.env).userDir, "themes");
  const missing: string[] = [];
  for (const name of wanted) {
    const path = join(themesDir, `${name}.json`);
    if (!(await pathExists(path))) missing.push(name);
  }
  if (missing.length === 0) {
    return ok("D04", "Referenced themes installed", `themes ok: ${wanted.join(", ")}`);
  }
  return {
    id: "D04",
    title: "Referenced themes installed",
    status: "warn",
    message: `missing themes: ${missing.join(", ")}`,
    hint: "run `agentline doctor --fix` to copy them from the bundled set",
  };
}

/** D05 — `git` on PATH (when any git widget enabled). */
async function checkD05(ctx: CheckCtx): Promise<CheckResult> {
  if (!hasGitWidget(ctx.config)) {
    return ok("D05", "git on PATH", "no git widget enabled — skipped");
  }
  try {
    await execFileP("git", ["--version"], { timeout: EXEC_TIMEOUTS.gitVersion });
    return ok("D05", "git on PATH", "git binary resolved");
  } catch {
    return {
      id: "D05",
      title: "git on PATH",
      status: "warn",
      message: "`git --version` failed",
      hint: "install git or remove git-* widgets from your config",
    };
  }
}

/**
 * D06 — The resolved global config directory is writable (or creatable).
 *
 * agentline is configured globally only; the single write target is
 * `${CLAUDE_CONFIG_DIR:-~/.config}/agentline`. This always probes that
 * resolved directory — there is no "skipped" path, because the bin
 * always has a config home regardless of whether `CLAUDE_CONFIG_DIR`
 * is set.
 */
async function checkD06(ctx: CheckCtx): Promise<CheckResult> {
  const { userDir } = resolveConfigPaths(ctx.env);
  const probe = await probeWritableDir(userDir);
  if (probe.ok) {
    return ok("D06", "Config directory writable", probe.message);
  }
  return {
    id: "D06",
    title: "Config directory writable",
    status: "warn",
    message: probe.message,
    hint: "chown/chmod the directory so `agentline edit` / `doctor --fix` can persist config and themes",
  };
}

/**
 * D07 — Update-check cache (read-only). Surfaces a hint when the cache
 * says a newer `@agentline/cli` exists. Never initiates a fetch from
 * inside `runChecks`; the cache is refreshed by `install`, `edit`,
 * and any future explicit refresh entry point. A missing cache or
 * registry-unreachable state is reported as `pass` with an
 * explanation — none of that is "broken host wiring".
 */
async function checkD07(ctx: CheckCtx): Promise<CheckResult> {
  const cache = readVersionCheckSync(ctx.env);
  if (cache === null) {
    return {
      id: "D07",
      title: "Update check",
      status: "pass",
      message: `no cached check yet (current: ${AGENTLINE_VERSION})`,
      hint: "run `agentline install` or `agentline edit` to populate the cache",
    };
  }
  if (cache.latest === null) {
    return {
      id: "D07",
      title: "Update check",
      status: "pass",
      message: `last probe failed; running ${AGENTLINE_VERSION}`,
    };
  }
  if (isNewer(cache.latest, AGENTLINE_VERSION)) {
    return {
      id: "D07",
      title: "Update check",
      status: "pass",
      message: `update available: ${AGENTLINE_VERSION} → ${cache.latest}`,
      hint: "npm i -g @agentline/cli",
    };
  }
  return {
    id: "D07",
    title: "Update check",
    status: "pass",
    message: `up to date (${AGENTLINE_VERSION})`,
  };
}

/** D08 — Render dry-run on embedded fixture matches snapshot. */
async function checkD08(_ctx: CheckCtx): Promise<CheckResult> {
  const ok = await runEmbeddedRenderFixture();
  if (ok.match) {
    return {
      id: "D08",
      title: "Render dry-run matches snapshot",
      status: "pass",
      message: "render fixture ok",
    };
  }
  return {
    id: "D08",
    title: "Render dry-run matches snapshot",
    status: "fail",
    message: ok.detail,
    hint: "the bin's render path drifted from the embedded snapshot — investigate src/cli.ts and src/render/",
  };
}

// ---------------- helpers ----------------

function settingsPath(home: string): string {
  return join(home, ".claude", "settings.json");
}

function ok(id: string, title: string, message: string): CheckResult {
  return { id, title, status: "pass", message };
}

async function readJsonOrNull(path: string): Promise<unknown> {
  try {
    const text = await fs.readFile(path, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractStatusLineCommand(sl: unknown): string | null {
  if (typeof sl === "string") return sl;
  if (isPlainObject(sl)) {
    const cmd = sl["command"];
    if (typeof cmd === "string") return cmd;
  }
  return null;
}

function collectReferencedThemes(cfg: AgentlineConfig | null): string[] {
  if (!cfg) return [];
  const out = new Set<string>();
  if (cfg.theme) out.add(cfg.theme);
  if (cfg.powerline.theme) out.add(cfg.powerline.theme);
  return [...out];
}

function hasGitWidget(cfg: AgentlineConfig | null): boolean {
  if (!cfg) return false;
  return cfg.lines.some((line) => line.widgets.some((w) => w.type.startsWith("git-")));
}

/**
 * Can the bin persist config/themes under `dir`? If `dir` exists it must
 * be a writable directory. If it does not exist yet (fresh install) the
 * nearest existing ancestor must be writable so the atomic-write
 * helper's `mkdir -p` can create the subtree. Every path string is
 * derived at runtime — no absolute-path literals (gate-02).
 */
async function probeWritableDir(dir: string): Promise<{ ok: boolean; message: string }> {
  try {
    const st = await fs.stat(dir);
    if (!st.isDirectory()) {
      return { ok: false, message: `${dir} exists but is not a directory` };
    }
    try {
      await fs.access(dir, fs.constants.W_OK);
      return { ok: true, message: `${dir} writable` };
    } catch {
      return { ok: false, message: `${dir} is not writable by the current user` };
    }
  } catch {
    // ENOENT (or unreadable) — fall through to the ancestor walk.
  }
  // `dir` does not exist. `mkdir -p` would create the missing chain from
  // the deepest *existing* ancestor downward, so the verdict is that
  // ancestor's writability — not some writable directory further up. We
  // must therefore stop at the first ancestor that exists and judge it,
  // climbing only past components that are themselves absent (ENOENT).
  let cur = dirname(dir);
  for (;;) {
    let st;
    try {
      st = await fs.stat(cur);
    } catch {
      const parent = dirname(cur);
      if (parent === cur) {
        return { ok: false, message: `${dir} cannot be created: no existing ancestor` };
      }
      cur = parent;
      continue;
    }
    if (!st.isDirectory()) {
      return { ok: false, message: `${dir} cannot be created: ${cur} is not a directory` };
    }
    try {
      await fs.access(cur, fs.constants.W_OK);
      return {
        ok: true,
        message: `${dir} does not exist yet; nearest existing parent ${cur} is writable`,
      };
    } catch {
      return {
        ok: false,
        message: `${dir} cannot be created: nearest existing parent ${cur} is not writable`,
      };
    }
  }
}
