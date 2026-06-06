/**
 * Shared context + helpers for the doctor checks (D01–D11).
 *
 * Each check is a pure async `(ctx) => CheckResult` in its own
 * `dNN-*.ts` file; this module owns the inputs they all share —
 * filesystem helpers, the settings-file path, status-line parsing,
 * config introspection, and the `ok` shorthand.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

import type { DictTranslator } from "../../../core/i18n/index.js";
import { isPlainObject } from "../../../core/lib/object/object.js";
import type { AgentlineConfig } from "../../../data/config/index.js";
import type { MaybeRefreshClaudeHealthOptions } from "../../claude-health/index.js";
import type { CheckResult } from "../types.js";

/**
 * Resolved inputs every check function takes. Built once by `runChecks`;
 * `config` / `configError` are populated by the eager `loadConfig` so D03
 * has the loader error and D04/D05/D09 have the merged config.
 */
export interface CheckCtx {
  home: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Lazily resolved merged config; some checks need it (D03, D04, D05, D09, D11). */
  config: AgentlineConfig | null;
  /** Loader error if config could not be loaded — used by D03. */
  configError: Error | null;
  /**
   * Dictionary-bound translator for `cmd.doctor.*` strings. Built once
   * by the orchestrator from the loaded config (or the identity
   * translator when config is unavailable).
   */
  t: DictTranslator;
  /**
   * Test seam: override the claude-health refresh used by D10. When
   * provided, D10 calls this instead of lazily importing the real
   * refresher. Allows tests to suppress the actual `claude` probe and
   * read only the pre-seeded cache file.
   */
  claudeHealthRefresh?: (options?: MaybeRefreshClaudeHealthOptions) => Promise<unknown>;
}

export const EXEC_TIMEOUTS = {
  gitVersion: 2000,
} as const;

export function ok(id: string, title: string, message: string): CheckResult {
  return { id, title, status: "pass", message };
}

export function settingsPath(home: string): string {
  return join(home, ".claude", "settings.json");
}

export async function readJsonOrNull(path: string): Promise<unknown> {
  try {
    const text = await fs.readFile(path, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractStatusLineCommand(sl: unknown): string | null {
  if (typeof sl === "string") return sl;
  if (isPlainObject(sl)) {
    const cmd = sl["command"];
    if (typeof cmd === "string") return cmd;
  }
  return null;
}

export function collectReferencedThemes(cfg: AgentlineConfig | null): string[] {
  if (!cfg) return [];
  const out = new Set<string>();
  if (cfg.theme) out.add(cfg.theme);
  if (cfg.powerline.theme) out.add(cfg.powerline.theme);
  return [...out];
}

export function hasGitWidget(cfg: AgentlineConfig | null): boolean {
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
export async function probeWritableDir(dir: string): Promise<{ ok: boolean; message: string }> {
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
