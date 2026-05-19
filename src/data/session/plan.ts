/**
 * Active-plan resolver (§7.2-adjacent).
 *
 * Discovers the most-recently-modified `*.md` under the `plans/`
 * directory (`${CLAUDE_CONFIG_DIR:-~/.claude}/plans`) and exposes its
 * basename (sans `.md`) as the active plan name. Resolution happens
 * once per render tick alongside the session/tokens/git snapshots —
 * the `plan` widget does no filesystem I/O during `render()` (§1.2 N3
 * budget, §7.1).
 *
 * Read-only, bounded (one directory listing + a stat per entry), and
 * never throws: a missing directory, an unreadable entry, or an empty
 * directory yields `null` so the widget hides cleanly.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveClaudeConfigDir, type AuthLookupSource } from "./auth-file.js";

export interface PlanSnapshot {
  /** Active plan name = basename of the newest plan file, sans `.md`. */
  readonly name: string;
  /**
   * `file://` URL of the active plan file. The `plan` widget passes it
   * through as the cell's OSC 8 `href` so the rendered name becomes a
   * clickable link that opens the plan file in OSC-8-capable terminals.
   */
  readonly href: string;
}

/** `${CLAUDE_CONFIG_DIR:-~/.claude}/plans`. */
export function resolvePlansDir(source: AuthLookupSource): string {
  return path.join(resolveClaudeConfigDir(source), "plans");
}

/**
 * Resolve the active plan: the newest `*.md` file directly under the
 * plans directory. Returns `null` when the directory is absent, empty,
 * holds no readable `.md` file, or any filesystem call fails — the
 * widget then hides.
 */
export function loadPlanSnapshot(source: AuthLookupSource): PlanSnapshot | null {
  const dir = resolvePlansDir(source);
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return null;
  }
  let newest: { file: string; mtimeMs: number } | null = null;
  for (const file of entries) {
    try {
      const st = statSync(path.join(dir, file));
      if (!st.isFile()) continue;
      if (newest === null || st.mtimeMs > newest.mtimeMs) {
        newest = { file, mtimeMs: st.mtimeMs };
      }
    } catch {
      /* skip an unreadable entry — never throw on the render path */
    }
  }
  if (newest === null) return null;
  const full = path.join(dir, newest.file);
  return { name: path.basename(newest.file, ".md"), href: pathToFileURL(full).href };
}
