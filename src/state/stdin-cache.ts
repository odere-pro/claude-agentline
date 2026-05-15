/**
 * Last-stdin cache (Phase 3 item 14).
 *
 * Every successful live render writes the parsed stdin payload to
 * `${agentlineConfigDir}/state/last-stdin.json` (atomic, write-temp +
 * fsync + rename — same pattern as `config/atomic.ts`). The TUI editor
 * reads this file at startup so its preview shows real values from the
 * user's most recent session instead of a baked-in demo fixture.
 *
 * Contract:
 *   - Write happens only on the live render path (no `--fixture`, no
 *     `--config`). Replays and goldens stay deterministic.
 *   - Failures are swallowed silently. The render must never fail
 *     because the cache couldn't be written — the user can't see the
 *     error and the cache is best-effort.
 *   - Read is synchronous because the TUI preview calls it from React
 *     renders; the file is small (one JSON object) and the TUI bundle
 *     is loaded only when `agentline edit` runs, so the read is off
 *     the render hot path.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeJsonIdempotent } from "../lib/atomic-write.js";
import { isPlainObject } from "../lib/object.js";
import { adaptStatuslinePayload, type StdinPayload } from "../stdin/index.js";

export const STDIN_CACHE_VERSION = 1 as const;

export interface CachedStdin {
  readonly version: typeof STDIN_CACHE_VERSION;
  readonly savedAt: string;
  readonly payload: StdinPayload;
}

export interface CachePaths {
  readonly stateDir: string;
  readonly cacheFile: string;
}

/**
 * Resolve the cache directory under the agentline config dir. Honours
 * `$CLAUDE_CONFIG_DIR` so the editor and the bin see the same file
 * regardless of where the user has placed their config.
 */
export function resolveCachePaths(env: NodeJS.ProcessEnv = process.env): CachePaths {
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir =
    cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const stateDir = join(agentlineDir, "state");
  return { stateDir, cacheFile: join(stateDir, "last-stdin.json") };
}

/**
 * Persist the most recent stdin payload. Best-effort: errors (e.g.
 * read-only home, permission denied) are swallowed so a broken cache
 * dir never breaks the user's statusline.
 */
export async function saveLastStdin(
  payload: StdinPayload,
  args: { readonly env?: NodeJS.ProcessEnv; readonly clock?: () => Date } = {},
): Promise<void> {
  const { cacheFile } = resolveCachePaths(args.env ?? process.env);
  const body: CachedStdin = {
    version: STDIN_CACHE_VERSION,
    savedAt: (args.clock ?? (() => new Date()))().toISOString(),
    payload,
  };
  try {
    await writeJsonIdempotent(cacheFile, body, { mode: 0o600, dirMode: 0o700 });
  } catch {
    // Silently swallow — the user can't see this error and the cache
    // is best-effort. The render path is unaffected.
  }
}

/**
 * Read the cached stdin payload synchronously. Returns `null` when the
 * file is absent, unreadable, malformed, or carries an unknown
 * version. Sync because the TUI preview reads it inside React renders;
 * the TUI bundle is only loaded when `agentline edit` runs, so this
 * never touches the render hot path.
 */
export function readLastStdinSync(env: NodeJS.ProcessEnv = process.env): CachedStdin | null {
  const { cacheFile } = resolveCachePaths(env);
  let raw: string;
  try {
    raw = readFileSync(cacheFile, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  if (parsed.version !== STDIN_CACHE_VERSION) return null;
  const cachedPayload = parsed.payload;
  if (!isPlainObject(cachedPayload)) return null;
  // Reconstruct the StdinPayload via the same adapter the live stdin
  // path uses (`adaptStatuslinePayload`). This re-validates every typed
  // field instead of trusting the on-disk shape — a stale cache from an
  // older agentline version whose `StdinPayload` had different field
  // names won't silently surface as a half-populated object.
  const rawObj = cachedPayload.raw;
  if (!isPlainObject(rawObj)) return null;
  const truncated = cachedPayload.truncated;
  const payload: StdinPayload = adaptStatuslinePayload(rawObj, {
    truncated: typeof truncated === "boolean" ? truncated : false,
  });
  return {
    version: STDIN_CACHE_VERSION,
    savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    payload,
  };
}
