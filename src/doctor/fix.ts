/**
 * Auto-fix routines for D01–D05. Anything outside that range is reported
 * but never auto-repaired (per spec).
 *
 * Each fix is idempotent: re-running `agentline doctor --fix` on an
 * already-healthy host MUST not mutate any byte. Atomic writes only.
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { writeJsonIdempotent } from "../lib/atomic-write.js";
import { DEFAULT_CONFIG, type AgentlineConfig } from "../config/index.js";
import { installNerdFont, resolveFontDir } from "../lib/font-install.js";
import { pathExists } from "../lib/fs.js";
import { detectNerdFontSync, stateDir, writeNerdFontStatus } from "../lib/nerd-font.js";
import { saveStatusLineBackup } from "../state/backup.js";
import type { CheckResult } from "./types.js";

interface FixCtx {
  home: string;
  env: NodeJS.ProcessEnv;
  /** Test seam — defaults to the real font installer. */
  fontInstaller?: typeof installNerdFont;
  /** Test seam — defaults to the real Nerd Font detection. */
  detectNerdFont?: typeof detectNerdFontSync;
}

export async function applyFixes(results: CheckResult[], ctx: FixCtx): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const r of results) {
    if (r.status !== "warn" && r.status !== "fail") {
      out.push(r);
      continue;
    }
    if (r.id === "D01") {
      out.push(await fixD01(r, ctx));
      continue;
    }
    if (r.id === "D02") {
      out.push(await fixD02(r, ctx));
      continue;
    }
    if (r.id === "D03") {
      out.push(await fixD03(r, ctx));
      continue;
    }
    if (r.id === "D04") {
      out.push(await fixD04(r, ctx));
      continue;
    }
    if (r.id === "D05") {
      out.push(await fixD05(r, ctx));
      continue;
    }
    out.push(r);
  }
  return out;
}

async function fixD01(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  const target = join(ctx.home, ".claude", "settings.json");
  await writeJsonIdempotent(target, {}, { mode: 0o600, dirMode: 0o700 });
  return { ...r, status: "fixed", message: `created ${target}`, fixed: true, hint: undefined };
}

async function fixD02(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  const target = join(ctx.home, ".claude", "settings.json");
  let parsed: Record<string, unknown> = {};
  try {
    const text = await fs.readFile(target, "utf8");
    const t = JSON.parse(text);
    if (t && typeof t === "object" && !Array.isArray(t)) parsed = t as Record<string, unknown>;
  } catch {
    /* leave empty — D01 fix would have been applied first */
  }
  /*
   * Snapshot the prior `statusLine` before we overwrite it. The backup
   * helper is idempotent (first install wins) so re-running --fix never
   * clobbers the original pre-install value with our own freshly-written
   * one. `scripts/uninstall.sh` reads the backup and restores the prior
   * state on removal.
   */
  const previousStatusLinePresent = Object.prototype.hasOwnProperty.call(parsed, "statusLine");
  const previousStatusLine = parsed["statusLine"];
  const backup = await saveStatusLineBackup({
    previousStatusLine,
    previousStatusLinePresent,
    env: ctx.env,
  });

  /*
   * Explicit `render` subcommand: matches `agentline install`'s wired form
   * and stays unambiguous against any future top-level subcommand.
   */
  parsed["statusLine"] = { type: "command", command: "npx -y @agentline/cli render", padding: 0 };
  await writeJsonIdempotent(target, parsed, { mode: 0o600, dirMode: 0o700 });
  const note = backup === "created" ? "; prior value backed up" : "";
  return {
    ...r,
    status: "fixed",
    message: `wrote statusLine = \`npx -y @agentline/cli render\`${note}`,
    fixed: true,
    hint: undefined,
  };
}

async function fixD03(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  const cfgDir = ctx.env.CLAUDE_CONFIG_DIR ?? join(ctx.home, ".config");
  const target = join(cfgDir, "agentline", "config.json");
  // Back up an existing-but-broken file before overwriting (per §1.4 O4).
  if (await pathExists(target)) {
    await fs.copyFile(target, `${target}.bak`).catch(() => undefined);
  }
  const fresh: AgentlineConfig = structuredClone(DEFAULT_CONFIG);
  await writeJsonIdempotent(target, fresh);
  return {
    ...r,
    status: "fixed",
    message: `wrote defaults to ${target} (prior file backed up to ${target}.bak)`,
    fixed: true,
    hint: undefined,
  };
}

async function fixD04(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  // Without bundled themes (T1 PR 7) we can't actually copy them — explain.
  void ctx;
  return {
    ...r,
    status: "warn",
    message: `${r.message} (auto-copy needs the bundled themes/ directory)`,
    hint: "run `scripts/install.sh` once it lands to seed themes/",
  };
}

async function fixD05(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  const detect = ctx.detectNerdFont ?? detectNerdFontSync;
  const install = ctx.fontInstaller ?? installNerdFont;
  const sentinelDir = stateDir(ctx.env, ctx.home);
  const manualHint =
    "download manually from https://www.nerdfonts.com" +
    " · macOS: brew install --cask font-jetbrains-mono-nerd-font" +
    ' · or set glyphs="off" in your config to disable';

  /*
   * Idempotency: if detection now succeeds, refresh the sentinel and
   * short-circuit. Mirrors `fixD02`'s "read state, modify if needed"
   * shape so re-running --fix on a healthy host mutates no bytes
   * beyond the timestamp inside the sentinel.
   */
  if (detect()) {
    await writeNerdFontStatus(sentinelDir, true).catch(() => undefined);
    return {
      ...r,
      status: "fixed",
      message: "Nerd Font already installed",
      fixed: true,
      hint: undefined,
    };
  }

  const fontDir = resolveFontDir({
    env: ctx.env,
    home: ctx.home || homedir(),
    platform: process.platform,
  });
  const result = await install({ fontDir });
  if ("error" in result) {
    return {
      ...r,
      status: "warn",
      message: `auto-install failed: ${result.error}`,
      hint: manualHint,
    };
  }
  const present = detect();
  await writeNerdFontStatus(sentinelDir, present).catch(() => undefined);
  if (!present) {
    return {
      ...r,
      status: "warn",
      message: `installed ${result.installed.length} font file(s) into ${fontDir} but detection still reports absent — terminal may need restart`,
      hint: manualHint,
    };
  }
  return {
    ...r,
    status: "fixed",
    message: `installed JetBrainsMono Nerd Font (${result.installed.length} file(s)) into ${fontDir}`,
    fixed: true,
    hint: undefined,
  };
}
