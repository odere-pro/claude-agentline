/**
 * Auto-fix routines for D01–D04. Anything outside that range is reported
 * but never auto-repaired (per spec).
 *
 * Each fix is idempotent: re-running `agentline doctor --fix` on an
 * already-healthy host MUST not mutate any byte. Atomic writes only.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { atomicWriteJson } from "../config/atomic.js";
import { DEFAULT_CONFIG, type AgentlineConfig } from "../config/index.js";
import { pathExists } from "../lib/fs.js";
import { saveStatusLineBackup } from "../state/backup.js";
import type { CheckResult } from "./types.js";

interface FixCtx {
  home: string;
  env: NodeJS.ProcessEnv;
}

export async function applyFixes(
  results: CheckResult[],
  ctx: FixCtx,
): Promise<CheckResult[]> {
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
    out.push(r);
  }
  return out;
}

async function fixD01(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  const target = join(ctx.home, ".claude", "settings.json");
  await atomicWriteJson(target, {}, { mode: 0o600, dirMode: 0o700 });
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
  // Snapshot the prior `statusLine` before we overwrite it. The backup
  // helper is idempotent (first install wins) so re-running --fix never
  // clobbers the original pre-install value with our own freshly-written
  // one. `scripts/uninstall.sh` reads the backup and restores the prior
  // state on removal.
  const previousStatusLinePresent = Object.prototype.hasOwnProperty.call(parsed, "statusLine");
  const previousStatusLine = parsed["statusLine"];
  const backup = await saveStatusLineBackup({
    previousStatusLine,
    previousStatusLinePresent,
    env: ctx.env,
  });

  // Explicit `render` subcommand: matches `agentline install`'s wired form
  // and stays unambiguous against any future top-level subcommand.
  parsed["statusLine"] = { type: "command", command: "npx -y @agentline/cli render", padding: 0 };
  await atomicWriteJson(target, parsed, { mode: 0o600, dirMode: 0o700 });
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
  await atomicWriteJson(target, fresh);
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

