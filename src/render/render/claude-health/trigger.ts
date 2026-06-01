/**
 * Render-path trigger for the claude-health refresh.
 *
 * The live render path may NOT spawn `claude` or hit the network itself
 * (gate 13 / gate 14). Instead, after the statusline has already been
 * written to stdout, it spawns a **detached, unref'd** `agentline
 * __refresh-claude-health` process when the cache is stale, then returns
 * immediately. The render process exits without waiting; the child does the
 * slow probe and writes the cache for the *next* render to read.
 *
 * This module imports only `data` (the cache reader) and node built-ins —
 * never `commands` — so the import-direction gate (gate-25) stays green and
 * the network/subprocess code never lands in the render cold-start graph.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { isClaudeHealthFresh } from "../../../data/state/claude-health-cache/claude-health-cache.js";

/**
 * Best-effort: when the claude-health cache is missing or stale, spawn a
 * detached refresh and return. Never throws, never blocks. A fresh cache is
 * a no-op (just one cheap synchronous read).
 */
export function maybeSpawnClaudeHealthRefresh(
  options: { readonly env?: NodeJS.ProcessEnv; readonly now?: number } = {},
): void {
  try {
    const env = options.env ?? process.env;
    const now = options.now ?? Date.now();
    if (isClaudeHealthFresh(now, env)) return;

    const entry = resolveCliEntry();
    if (entry === null) return;

    const child = spawn(process.execPath, [entry, "__refresh-claude-health"], {
      detached: true,
      stdio: "ignore",
      env,
    });
    child.on("error", () => {
      /* binary/spawn failure — the next render simply tries again. */
    });
    child.unref();
  } catch {
    /* Best-effort — a refresh trigger must never affect the render. */
  }
}

/**
 * Resolve the agentline CLI entry script to re-invoke. Prefers the actual
 * script that started this process (`process.argv[1]`, e.g. the installed
 * `dist/cli.mjs`); falls back to this module's compiled location only if
 * argv is unusable.
 */
function resolveCliEntry(): string | null {
  const argvEntry = process.argv[1];
  if (typeof argvEntry === "string" && argvEntry.length > 0) return argvEntry;
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
}
