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
import { runEmbeddedRenderFixture } from "./fixture.js";
import type { CheckResult, RunOptions } from "./types.js";

const execFileP = promisify(execFile);

interface CheckCtx {
  home: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Lazily resolved merged config; some checks need it (D03, D04, D05, D06, D09). */
  config: AgentlineConfig | null;
  /** Loader error if config could not be loaded — used by D03. */
  configError: Error | null;
}

export async function runChecks(opts: RunOptions): Promise<CheckResult[]> {
  const ctx: CheckCtx = {
    home: opts.home ?? homedir(),
    env: opts.env ?? process.env,
    cwd: opts.cwd ?? process.cwd(),
    config: null,
    configError: null,
  };
  try {
    const loaded = await loadConfig({ env: ctx.env, cwd: ctx.cwd });
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
  if (await fileExists(settings)) {
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
  if (parsed === null) {
    return {
      id: "D02",
      title: "statusLine wired to agentline",
      status: "warn",
      message: "Claude Code settings file is missing or unreadable",
      hint: "fix D01 first, then run `agentline doctor --fix`",
    };
  }
  const sl = (parsed as Record<string, unknown>)["statusLine"];
  if (sl === undefined || sl === null) {
    return {
      id: "D02",
      title: "statusLine wired to agentline",
      status: "warn",
      message: "settings.json has no `statusLine` entry",
      hint: "run `agentline doctor --fix` to wire `npx -y @agentline/cli`",
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
    if (!(await fileExists(path))) missing.push(name);
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

/** D05 — Nerd Font installed (Powerline only). Heuristic; report-only. */
async function checkD05(ctx: CheckCtx): Promise<CheckResult> {
  if (!ctx.config?.powerline.enabled) {
    return ok("D05", "Nerd Font present (Powerline)", "powerline disabled — skipped");
  }
  const installed = await detectNerdFont();
  if (installed) {
    return ok("D05", "Nerd Font present (Powerline)", "nerd font detected");
  }
  return {
    id: "D05",
    title: "Nerd Font present (Powerline)",
    status: "warn",
    message: "no Nerd Font detected for Powerline glyphs",
    hint: "macOS: brew install --cask font-jetbrains-mono-nerd-font · Linux: see docs/install.md · Windows: see docs/install.md",
  };
}

/** D06 — `git` on PATH (when any git widget enabled). */
async function checkD06(ctx: CheckCtx): Promise<CheckResult> {
  if (!hasGitWidget(ctx.config)) {
    return ok("D06", "git on PATH", "no git widget enabled — skipped");
  }
  try {
    await execFileP("git", ["--version"], { timeout: 2000 });
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
  // The pricing table ships with the bin (when `src/tokens/pricing.ts` lands).
  // Until then this check skips with a clear message.
  return {
    id: "D07",
    title: "Pricing table fresh (≤90 days)",
    status: "skip",
    message: "pricing table not present in this build",
    hint: "ships with the cost / tokens widget family",
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

/** D09 — Custom-command widgets resolve their `cmd` to an executable. */
async function checkD09(ctx: CheckCtx): Promise<CheckResult> {
  const cmds = collectCommandWidgets(ctx.config);
  if (cmds.length === 0) {
    return ok("D09", "Custom-command widgets resolve", "no command widgets configured");
  }
  const broken: string[] = [];
  for (const cmd of cmds) {
    if (!(await commandResolves(cmd, ctx.env))) broken.push(cmd);
  }
  if (broken.length === 0) {
    return ok("D09", "Custom-command widgets resolve", `${cmds.length} command(s) ok`);
  }
  return {
    id: "D09",
    title: "Custom-command widgets resolve",
    status: "warn",
    message: `unresolved: ${broken.join(" | ")}`,
    hint: "edit the widget options.cmd or install the missing tool",
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
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
  if (typeof sl === "object" && sl !== null) {
    const cmd = (sl as Record<string, unknown>)["command"];
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

function collectCommandWidgets(cfg: AgentlineConfig | null): string[] {
  if (!cfg) return [];
  const out: string[] = [];
  for (const line of cfg.lines) {
    for (const w of line.widgets) {
      if (w.type !== "command") continue;
      const cmd = (w.options ?? {})["cmd"];
      if (typeof cmd === "string" && cmd.length > 0) out.push(cmd);
    }
  }
  return out;
}

async function commandResolves(cmd: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  // Take the first whitespace-delimited token; skip if it's a shell builtin.
  const exe = cmd.trim().split(/\s+/)[0];
  if (!exe || /^(if|for|while|cd|echo|test|true|false)$/.test(exe)) return true;
  try {
    await execFileP(process.platform === "win32" ? "where" : "which", [exe], { timeout: 1500, env });
    return true;
  } catch {
    return false;
  }
}

async function detectNerdFont(): Promise<boolean> {
  // Best-effort cross-platform check — looks for a `*Nerd Font*` family
  // via `fc-list` (Linux), system_profiler (macOS), or a font-cache file
  // on Windows. Failure to find one is reported as warn, never fatal.
  try {
    if (process.platform === "linux") {
      const { stdout } = await execFileP("fc-list", [], { timeout: 2500 });
      return /nerd font/i.test(stdout);
    }
    if (process.platform === "darwin") {
      const { stdout } = await execFileP("system_profiler", ["SPFontsDataType"], { timeout: 5000 });
      return /nerd font/i.test(stdout);
    }
  } catch {
    /* fall through to false */
  }
  return false;
}
