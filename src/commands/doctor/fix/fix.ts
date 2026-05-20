/**
 * Auto-fix routines for D01–D04 and D09. Anything outside that set is
 * reported but never auto-repaired (per spec).
 *
 * Each fix is idempotent: re-running `agentline doctor --fix` on an
 * already-healthy host MUST not mutate any byte. Atomic writes only.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { DEFAULT_CONFIG, type AgentlineConfig } from "../../../data/config/index.js";
import { loadConfig } from "../../../data/config/load/load.js";
import { syncRefreshInterval } from "../../../core/lib/settings-refresh/settings-refresh.js";
import { pathExists } from "../../../core/lib/fs/fs.js";
import { saveStatusLineBackup } from "../../../data/state/backup/backup.js";
import type { CheckResult } from "../types.js";

interface FixCtx {
  home: string;
  env: NodeJS.ProcessEnv;
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
    if (r.id === "D09") {
      out.push(await fixD09(r, ctx));
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
   *
   * Mirror install's `refreshInterval` so a single `doctor --fix`
   * converges the host in one pass: without this, D02's fix wires the
   * statusLine but D09 (evaluated before fixes ran, when no statusLine
   * existed) stays a no-op, and the interval only lands on a *second*
   * --fix run — breaking the one-pass idempotency invariant.
   */
  const { config } = await loadConfig({ env: ctx.env });
  const statusLine: Record<string, unknown> = {
    type: "command",
    command: "npx -y @odere-pro/agentline render",
    padding: 0,
  };
  if (config.refreshInterval >= 1) statusLine["refreshInterval"] = config.refreshInterval;
  parsed["statusLine"] = statusLine;
  await writeJsonIdempotent(target, parsed, { mode: 0o600, dirMode: 0o700 });
  const note = backup === "created" ? "; prior value backed up" : "";
  return {
    ...r,
    status: "fixed",
    message: `wrote statusLine = \`npx -y @odere-pro/agentline render\`${note}`,
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

/**
 * D09 — re-sync settings.json `statusLine.refreshInterval` from the
 * configured value. `syncRefreshInterval` is itself idempotent (it
 * returns `unchanged` without writing when already in sync) and only
 * touches an agentline-wired statusLine, so a foreign / unwired host
 * stays a `warn` pointing at `agentline install`.
 */
async function fixD09(r: CheckResult, ctx: FixCtx): Promise<CheckResult> {
  const { config } = await loadConfig({ env: ctx.env });
  const result = await syncRefreshInterval(ctx.home, config.refreshInterval);
  if (result.kind === "not-wired") {
    return {
      ...r,
      status: "warn",
      message: "statusLine is not wired to agentline; cannot sync refreshInterval",
      hint: "run `agentline install` to wire the statusline first",
    };
  }
  const detail =
    result.kind === "written"
      ? `wrote statusLine.refreshInterval=${result.value}`
      : result.kind === "removed"
        ? "removed statusLine.refreshInterval (refresh disabled)"
        : `already in sync (refreshInterval=${config.refreshInterval})`;
  return { ...r, status: "fixed", message: detail, fixed: true, hint: undefined };
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
