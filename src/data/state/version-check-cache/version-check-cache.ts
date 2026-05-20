/**
 * Cache for the most recent npm-registry version check (§9.2 add-on).
 *
 * Lives under `${agentlineDir}/state/version-check.json`, written by
 * `install` / `edit` / `doctor` after a successful npm-registry query
 * (see `src/update-check/refresh.ts`), read by `doctor` and any other
 * non-hot-path surface that wants to surface an "update available"
 * hint.
 *
 * Contract — render path:
 *   - **NEVER reads the cache during stdin → stdout render.** Gate 14
 *     enforces no-network on render; we additionally keep render from
 *     touching this file at all so a future change can't accidentally
 *     pull network through a sync read of a stale cache entry's URL.
 *
 * Contract — writers:
 *   - Atomic write (write-temp + fsync + rename) via `writeJsonIdempotent`
 *     — same pattern as `render-cache.ts`, `stdin-cache.ts`,
 *     `backup.ts`. Failures are swallowed (best-effort).
 *
 * Contract — readers (off the render path):
 *   - Sync read; returns `null` on any failure (missing file,
 *     malformed JSON, unknown version, missing required fields).
 *   - The caller decides whether the cache is fresh enough; this
 *     module owns format/IO only.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { isPlainObject } from "../../../core/lib/object/object.js";

export const VERSION_CHECK_CACHE_VERSION = 1 as const;

export interface VersionCheckCache {
  readonly version: typeof VERSION_CHECK_CACHE_VERSION;
  /** ISO timestamp of the last completed registry probe. */
  readonly savedAt: string;
  /** Installed agentline version at write time (mirrors `AGENTLINE_VERSION`). */
  readonly current: string;
  /** Latest version advertised by npm, or `null` when the probe failed. */
  readonly latest: string | null;
}

export interface VersionCheckCachePaths {
  readonly stateDir: string;
  readonly cacheFile: string;
}

/**
 * Resolve the cache file under the agentline config dir. Honours
 * `$CLAUDE_CONFIG_DIR` so install, doctor, edit, and any tooling that
 * shares the agentline state directory see the same file.
 */
export function resolveVersionCheckPaths(
  env: NodeJS.ProcessEnv = process.env,
): VersionCheckCachePaths {
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir = cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const stateDir = join(agentlineDir, "state");
  return { stateDir, cacheFile: join(stateDir, "version-check.json") };
}

/**
 * Persist the result of a registry probe. Best-effort — errors
 * (read-only home, permission denied, EXDEV on cross-mount renames) are
 * swallowed so a broken cache dir never breaks install / doctor /
 * edit.
 */
export async function saveVersionCheck(
  entry: Omit<VersionCheckCache, "version">,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { cacheFile } = resolveVersionCheckPaths(env);
  const body: VersionCheckCache = { version: VERSION_CHECK_CACHE_VERSION, ...entry };
  try {
    await writeJsonIdempotent(cacheFile, body, { mode: 0o600, dirMode: 0o700 });
  } catch {
    /*
     * Silently swallow — the user can't see this error and the cache
     * is best-effort. The caller proceeds as if the write succeeded.
     */
  }
}

/**
 * Read the cached probe synchronously. Returns `null` when the file is
 * absent, unreadable, malformed, or carries an unknown version.
 */
export function readVersionCheckSync(
  env: NodeJS.ProcessEnv = process.env,
): VersionCheckCache | null {
  const { cacheFile } = resolveVersionCheckPaths(env);
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
  if (parsed.version !== VERSION_CHECK_CACHE_VERSION) return null;
  if (typeof parsed.savedAt !== "string") return null;
  if (typeof parsed.current !== "string") return null;
  if (parsed.latest !== null && typeof parsed.latest !== "string") return null;
  return {
    version: VERSION_CHECK_CACHE_VERSION,
    savedAt: parsed.savedAt,
    current: parsed.current,
    latest: parsed.latest,
  };
}
