/**
 * Session → latest-plan cache.
 *
 * Maps each `session_id` reported by Claude Code to the plan that session
 * most recently entered (its `plan_mode` attachment, resolved from the
 * session's transcript by `data/session/plan`). The `plan` widget reads
 * this as a fallback when the transcript is momentarily unreadable, and
 * it is the durable per-session store requested by the user — so two
 * sessions / worktrees open at once each surface their own plan instead
 * of whichever plan file was touched last globally.
 *
 * File: `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/state/session-plan.json`.
 *
 * Contract (same as the sibling caches):
 *   - Reads are synchronous, best-effort: a missing / malformed / wrong
 *     version file yields `null`, never an error.
 *   - Writes go through the atomic helper and are serialised with a
 *     cross-process file lock (many concurrent sessions share one map
 *     file). Failures are swallowed — the render must never fail because
 *     the cache could not be written.
 *   - The common unchanged-tick path is lock-free: `recordSessionPlan`
 *     skips entirely when the stored plan already matches.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { withFileLock } from "../../../core/lib/file-lock/file-lock.js";
import { isPlainObject } from "../../../core/lib/object/object.js";

export const SESSION_PLAN_CACHE_VERSION = 1 as const;

export interface SessionPlanEntry {
  /** Absolute path of the session's active plan file. */
  readonly planFilePath: string;
  /** Display name = basename of the plan file, sans `.md`. */
  readonly name: string;
  /** ISO timestamp the entry was recorded. */
  readonly recordedAt: string;
}

export interface SessionPlanCache {
  readonly version: typeof SESSION_PLAN_CACHE_VERSION;
  readonly sessions: Readonly<Record<string, SessionPlanEntry>>;
}

export interface SessionPlanPaths {
  readonly stateDir: string;
  readonly cacheFile: string;
}

/**
 * Resolve the cache directory under the agentline config dir. Honours
 * `$CLAUDE_CONFIG_DIR` so the bin and the editor see the same file.
 */
export function resolveSessionPlanPaths(env: NodeJS.ProcessEnv = process.env): SessionPlanPaths {
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir = cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const stateDir = join(agentlineDir, "state");
  return { stateDir, cacheFile: join(stateDir, "session-plan.json") };
}

function readCacheSync(cacheFile: string): SessionPlanCache | null {
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
  if (parsed.version !== SESSION_PLAN_CACHE_VERSION) return null;
  const sessions = parsed.sessions;
  if (!isPlainObject(sessions)) return null;
  const out: Record<string, SessionPlanEntry> = {};
  for (const [id, entry] of Object.entries(sessions)) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry.planFilePath !== "string" || entry.planFilePath === "") continue;
    if (typeof entry.name !== "string") continue;
    out[id] = {
      planFilePath: entry.planFilePath,
      name: entry.name,
      recordedAt: typeof entry.recordedAt === "string" ? entry.recordedAt : "",
    };
  }
  return { version: SESSION_PLAN_CACHE_VERSION, sessions: out };
}

/**
 * Read the recorded plan for one session. Returns `null` when there is no
 * cache file, no entry, or the file is unreadable / malformed.
 */
export function readSessionPlanEntrySync(
  sessionId: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): SessionPlanEntry | null {
  if (!sessionId) return null;
  const { cacheFile } = resolveSessionPlanPaths(env);
  const cache = readCacheSync(cacheFile);
  return cache?.sessions[sessionId] ?? null;
}

export interface RecordSessionPlanArgs {
  readonly env?: NodeJS.ProcessEnv;
  readonly clock?: () => Date;
  /** Override the file-lock wait (tests use a tiny value). */
  readonly lockTimeoutMs?: number;
}

/**
 * Record a session's active plan. Best-effort and idempotent: the common
 * case (the stored plan already matches) returns without taking the lock
 * or writing. On a real change it serialises the read-modify-write with a
 * cross-process lock and prunes entries whose plan file no longer exists.
 */
export async function recordSessionPlan(
  sessionId: string | undefined,
  planFilePath: string,
  name: string,
  args: RecordSessionPlanArgs = {},
): Promise<void> {
  if (!sessionId) return;
  const env = args.env ?? process.env;
  const { cacheFile } = resolveSessionPlanPaths(env);

  // Cheap lock-free pre-check: nothing to do when unchanged.
  const existing = readCacheSync(cacheFile);
  if (existing?.sessions[sessionId]?.planFilePath === planFilePath) return;

  const recordedAt = (args.clock ?? (() => new Date()))().toISOString();
  try {
    await withFileLock(
      cacheFile,
      async () => {
        const current = readCacheSync(cacheFile);
        const merged: Record<string, SessionPlanEntry> = {
          ...(current?.sessions ?? {}),
          [sessionId]: { planFilePath, name, recordedAt },
        };
        // Prune entries whose plan file vanished; always keep the current id.
        const pruned: Record<string, SessionPlanEntry> = {};
        for (const [id, entry] of Object.entries(merged)) {
          if (id === sessionId || existsSync(entry.planFilePath)) pruned[id] = entry;
        }
        await writeJsonIdempotent(
          cacheFile,
          { version: SESSION_PLAN_CACHE_VERSION, sessions: pruned },
          { mode: 0o600, dirMode: 0o700 },
        );
      },
      args.lockTimeoutMs !== undefined ? { timeoutMs: args.lockTimeoutMs } : {},
    );
  } catch {
    /* Best-effort — a broken cache dir must never break the statusline. */
  }
}
