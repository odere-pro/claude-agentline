/**
 * Implementations of the ten doctor checks (D01–D10).
 *
 * Reporting and repair are split: a check NEVER mutates the host;
 * `--fix` calls the matching `tryFix*` helper in `fix.ts` separately
 * (only D01–D04 have fixers, per spec).
 *
 * On a missing-but-expected file (e.g. no Powerline-only Nerd Font when
 * Powerline is disabled) the check returns `pass` with an explanatory
 * message — there is nothing wrong with the host in that scenario.
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig, type AgentlineConfig } from "../config/index.js";
import { resolveEnv } from "../lib/env.js";
import { pathExists } from "../lib/fs.js";
import { isPlainObject } from "../lib/object.js";
import { readVersionCheckSync } from "../state/version-check-cache.js";
import { PRICING_TABLE_VERSION } from "../tokens/pricing.js";
import { isNewer } from "../update-check/refresh.js";
import { AGENTLINE_VERSION } from "../version.js";
import { runEmbeddedRenderFixture } from "./fixture.js";
import type { CheckResult, RunOptions } from "./types.js";

const PRICING_FRESH_MAX_DAYS = 90;
const MS_PER_DAY = 86_400_000;

const execFileP = promisify(execFile);

const EXEC_TIMEOUTS = {
  gitVersion: 2000,
  fcList: 2500,
  systemProfiler: 5000,
} as const;

interface CheckCtx {
  home: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Lazily resolved merged config; some checks need it (D03, D04, D05, D06). */
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
    await checkD09(ctx),
    await checkD10(ctx),
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
  const themesDir = join(ctx.home, ".config", "agentline", "themes");
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

/**
 * D05 — Nerd Font installed. Required by Powerline mode and by
 * `config.glyphs === "nerd-font"` (the default), since both prepend
 * Nerd Font PUA codepoints that render as tofu boxes without the
 * font. Heuristic; report-only.
 */
async function checkD05(ctx: CheckCtx): Promise<CheckResult> {
  const wantsPowerline = ctx.config?.powerline.enabled === true;
  const wantsGlyphs = ctx.config?.glyphs === "nerd-font";
  if (!wantsPowerline && !wantsGlyphs) {
    return ok("D05", "Nerd Font present", "powerline + glyphs both off — skipped");
  }
  const installed = await detectNerdFont();
  if (installed) {
    return ok("D05", "Nerd Font present", "nerd font detected");
  }
  const reason = wantsPowerline && wantsGlyphs
    ? "no Nerd Font detected for Powerline + glyphs"
    : wantsPowerline
      ? "no Nerd Font detected for Powerline glyphs"
      : "no Nerd Font detected for config.glyphs=\"nerd-font\"";
  return {
    id: "D05",
    title: "Nerd Font present",
    status: "warn",
    message: reason,
    hint:
      "download a Nerd Font from https://www.nerdfonts.com (e.g. JetBrainsMono, FiraCode, Hack)" +
      " · macOS: brew install --cask font-jetbrains-mono-nerd-font" +
      " · or set glyphs=\"off\" in your config to disable",
  };
}

/** D06 — `git` on PATH (when any git widget enabled). */
async function checkD06(ctx: CheckCtx): Promise<CheckResult> {
  if (!hasGitWidget(ctx.config)) {
    return ok("D06", "git on PATH", "no git widget enabled — skipped");
  }
  try {
    await execFileP("git", ["--version"], { timeout: EXEC_TIMEOUTS.gitVersion });
    return ok("D06", "git on PATH", "git binary resolved");
  } catch {
    return {
      id: "D06",
      title: "git on PATH",
      status: "warn",
      message: "`git --version` failed",
      hint: "install git or remove git-* widgets from your config",
    };
  }
}

/** D07 — Pricing table fresher than now − 90 days. Reports only. */
async function checkD07(_ctx: CheckCtx): Promise<CheckResult> {
  const verdict = evaluatePricingFreshness(PRICING_TABLE_VERSION, new Date());
  return {
    id: "D07",
    title: "Pricing table fresh (≤90 days)",
    ...verdict,
  };
}

/**
 * Decide whether an embedded pricing-table version date is within the
 * staleness threshold. Pure helper so D07 stays deterministic in tests.
 */
export function evaluatePricingFreshness(
  version: string,
  now: Date,
): Pick<CheckResult, "status" | "message" | "hint"> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  const parsed = match ? new Date(`${version}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return {
      status: "warn",
      message: `PRICING_TABLE_VERSION="${version}" is not a valid YYYY-MM-DD date`,
      hint: "ship a release with a corrected PRICING_TABLE_VERSION in src/tokens/pricing.ts",
    };
  }
  const rawAge = Math.floor((now.getTime() - parsed.getTime()) / MS_PER_DAY);
  const ageDays = Math.max(0, rawAge);
  if (ageDays <= PRICING_FRESH_MAX_DAYS) {
    return {
      status: "pass",
      message: `pricing table dated ${version} (${ageDays}d old)`,
    };
  }
  return {
    status: "warn",
    message: `pricing table dated ${version} is ${ageDays}d old (threshold ${PRICING_FRESH_MAX_DAYS})`,
    hint: "refresh src/tokens/pricing.ts and bump PRICING_TABLE_VERSION as part of the next release",
  };
}

/** D08 — `CLAUDE_CONFIG_DIR` writable (when set). */
async function checkD08(ctx: CheckCtx): Promise<CheckResult> {
  const dir = ctx.env.CLAUDE_CONFIG_DIR;
  if (!dir) return ok("D08", "CLAUDE_CONFIG_DIR writable", "CLAUDE_CONFIG_DIR not set — skipped");
  try {
    await fs.access(dir, fs.constants.W_OK);
    return ok("D08", "CLAUDE_CONFIG_DIR writable", `${dir} writable`);
  } catch {
    return {
      id: "D08",
      title: "CLAUDE_CONFIG_DIR writable",
      status: "warn",
      message: `${dir} is not writable by the current user`,
      hint: "chown / chmod the directory, or unset CLAUDE_CONFIG_DIR to fall back to ~/.config",
    };
  }
}

/**
 * D09 — Update-check cache (read-only). Surfaces a hint when the cache
 * says a newer `@agentline/cli` exists. Never initiates a fetch from
 * inside `runChecks`; the cache is refreshed by `install`, `edit`,
 * and any future explicit refresh entry point. A missing cache or
 * registry-unreachable state is reported as `pass` with an
 * explanation — none of that is "broken host wiring".
 */
async function checkD09(ctx: CheckCtx): Promise<CheckResult> {
  const cache = readVersionCheckSync(ctx.env);
  if (cache === null) {
    return {
      id: "D09",
      title: "Update check",
      status: "pass",
      message: `no cached check yet (current: ${AGENTLINE_VERSION})`,
      hint: "run `agentline install` or `agentline edit` to populate the cache",
    };
  }
  if (cache.latest === null) {
    return {
      id: "D09",
      title: "Update check",
      status: "pass",
      message: `last probe failed; running ${AGENTLINE_VERSION}`,
    };
  }
  if (isNewer(cache.latest, AGENTLINE_VERSION)) {
    return {
      id: "D09",
      title: "Update check",
      status: "pass",
      message: `update available: ${AGENTLINE_VERSION} → ${cache.latest}`,
      hint: "npm i -g @agentline/cli",
    };
  }
  return {
    id: "D09",
    title: "Update check",
    status: "pass",
    message: `up to date (${AGENTLINE_VERSION})`,
  };
}

/** D10 — Render dry-run on embedded fixture matches snapshot. */
async function checkD10(_ctx: CheckCtx): Promise<CheckResult> {
  const ok = await runEmbeddedRenderFixture();
  if (ok.match) {
    return { id: "D10", title: "Render dry-run matches snapshot", status: "pass", message: "render fixture ok" };
  }
  return {
    id: "D10",
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

async function detectNerdFont(): Promise<boolean> {
  // Best-effort cross-platform check — looks for a `*Nerd Font*` family
  // via `fc-list` (Linux), system_profiler (macOS), or a font-cache file
  // on Windows. Failure to find one is reported as warn, never fatal.
  try {
    if (process.platform === "linux") {
      const { stdout } = await execFileP("fc-list", [], { timeout: EXEC_TIMEOUTS.fcList });
      return /nerd font/i.test(stdout);
    }
    if (process.platform === "darwin") {
      const { stdout } = await execFileP("system_profiler", ["SPFontsDataType"], { timeout: EXEC_TIMEOUTS.systemProfiler });
      return /nerd font/i.test(stdout);
    }
  } catch {
    /* fall through to false */
  }
  return false;
}
