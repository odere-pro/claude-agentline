/**
 * Last-known-good git-snapshot cache (Memento for the previous tick's
 * git working-tree state).
 *
 * agentline runs as a fresh process on every statusline tick, so there
 * is no in-memory state to carry git data between ticks. When a tick's
 * `git` calls time out, the loader has nothing to fall back on and the
 * git family flickers (branch → SHA → hidden, worktree hidden, dirty →
 * clean). This cache persists each successful snapshot so the next slow
 * tick can hold last-known-good instead of blanking.
 *
 * Mirrors `render-cache.ts` (atomic write-temp + fsync + rename; sync,
 * absence-tolerant read) with one difference: it is **keyed per `cwd`**,
 * one file per repo (filename = a short hash of the absolute `cwd`).
 * Per-file writes are race-safe under atomic rename and stop two repos
 * open in two terminals from clobbering each other's last-known-good.
 *
 * Contract:
 *   - Written only on the live render path (best-effort, async). Errors
 *     are swallowed — a broken cache dir never breaks the statusline.
 *   - Read synchronously by the live snapshot loader, exactly once per
 *     tick, and passed to `loadGitSnapshot` as `previous`.
 *   - A missing / malformed / version-mismatched / cwd-mismatched file
 *     reads back as `null`; the loader then behaves as it did before the
 *     cache existed. Deleting any file is safe.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { isPlainObject } from "../../../core/lib/object/object.js";
import type { GitSnapshot } from "../../git/snapshot/snapshot.js";

export const GIT_SNAPSHOT_CACHE_VERSION = 1 as const;

export interface CachedGitSnapshot {
  readonly version: typeof GIT_SNAPSHOT_CACHE_VERSION;
  readonly savedAt: string;
  readonly cwd: string;
  readonly snapshot: GitSnapshot;
}

/**
 * Resolve the per-cwd cache file under the agentline config dir. Honours
 * `$CLAUDE_CONFIG_DIR` so the bin, editor preview, and any diagnostic
 * surface agree on the path. The filename is a 16-hex-char SHA-256
 * prefix of the absolute `cwd` — bounded length, no path-separator or
 * length surprises from the raw directory string.
 */
export function resolveGitSnapshotCacheFile(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir = cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const key = createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  return join(agentlineDir, "state", "git-snapshot", `${key}.json`);
}

/**
 * Persist the most recent successful git snapshot. No-op for an
 * unavailable snapshot (nothing worth holding, and no `cwd` to key on).
 * Best-effort: errors (read-only home, permission denied) are swallowed
 * so a broken cache dir never breaks the render path.
 */
export async function saveGitSnapshot(
  snapshot: GitSnapshot,
  args: { readonly env?: NodeJS.ProcessEnv; readonly clock?: () => Date } = {},
): Promise<void> {
  // Defensive: an unavailable snapshot has no cwd to key on and nothing
  // worth holding. The live caller already gates on availability.
  if (snapshot?.available !== true || !snapshot.cwd) return;
  const env = args.env ?? process.env;
  const file = resolveGitSnapshotCacheFile(snapshot.cwd, env);
  const body: CachedGitSnapshot = {
    version: GIT_SNAPSHOT_CACHE_VERSION,
    savedAt: (args.clock ?? (() => new Date()))().toISOString(),
    cwd: snapshot.cwd,
    snapshot,
  };
  try {
    await writeJsonIdempotent(file, body, { mode: 0o600, dirMode: 0o700 });
  } catch {
    /* Best-effort — the user can't see this error and the cache is advisory. */
  }
}

/**
 * Read the last-known-good snapshot for `cwd`. Returns `null` when the
 * file is absent, unreadable, malformed, carries an unknown version, or
 * was saved for a different `cwd` (hash collision guard). The returned
 * snapshot is re-frozen so callers can treat it as immutable.
 */
export function readGitSnapshotSync(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): GitSnapshot | null {
  const file = resolveGitSnapshotCacheFile(cwd, env);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
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
  if (parsed.version !== GIT_SNAPSHOT_CACHE_VERSION) return null;
  if (parsed.cwd !== cwd) return null;
  return parseSnapshot(parsed.snapshot, cwd);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function strOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function parseCounts(value: unknown): GitSnapshot["status"] | null {
  if (!isPlainObject(value)) return null;
  const staged = num(value.staged);
  const unstaged = num(value.unstaged);
  const untracked = num(value.untracked);
  const conflicts = num(value.conflicts);
  const modified = num(value.modified);
  const added = num(value.added);
  if (
    staged === null ||
    unstaged === null ||
    untracked === null ||
    conflicts === null ||
    modified === null ||
    added === null
  ) {
    return null;
  }
  return { staged, unstaged, untracked, conflicts, modified, added };
}

function parseShortstat(value: unknown): GitSnapshot["diff"] | null {
  if (!isPlainObject(value)) return null;
  const insertions = num(value.insertions);
  const deletions = num(value.deletions);
  const filesChanged = num(value.filesChanged);
  if (insertions === null || deletions === null || filesChanged === null) return null;
  return { insertions, deletions, filesChanged };
}

function parseAheadBehind(value: unknown): GitSnapshot["aheadBehind"] | null {
  if (!isPlainObject(value)) return null;
  const ahead = num(value.ahead);
  const behind = num(value.behind);
  if (ahead === null || behind === null) return null;
  return { ahead, behind };
}

function parseRemote(value: unknown): GitSnapshot["origin"] | null | undefined {
  if (value === null) return null;
  if (!isPlainObject(value)) return undefined;
  const owner = str(value.owner);
  const repo = str(value.repo);
  if (owner === null || repo === null) return undefined;
  return { owner, repo };
}

function parsePr(value: unknown): GitSnapshot["pr"] | undefined {
  if (value === null) return null;
  if (!isPlainObject(value)) return undefined;
  const number = num(value.number);
  const url = str(value.url);
  const title = str(value.title);
  if (number === null || url === null || title === null) return undefined;
  return { number, url, title };
}

/**
 * Validate a parsed snapshot back into a frozen `GitSnapshot`, or `null`
 * if any field is missing or the wrong type. Tolerant by design — a
 * structurally-invalid cache is treated as absent, never an error.
 */
function parseSnapshot(value: unknown, cwd: string): GitSnapshot | null {
  if (!isPlainObject(value)) return null;
  if (value.available !== true) return null;

  const branch = str(value.branch);
  const sha = str(value.sha);
  const shortSha = str(value.shortSha);
  if (branch === null || sha === null || shortSha === null) return null;
  if (typeof value.detached !== "boolean" || typeof value.inWorktree !== "boolean") return null;

  const status = parseCounts(value.status);
  const diff = parseShortstat(value.diff);
  const diffStaged = parseShortstat(value.diffStaged);
  const aheadBehind = parseAheadBehind(value.aheadBehind);
  if (status === null || diff === null || diffStaged === null || aheadBehind === null) return null;

  const upstream = strOrNull(value.upstream);
  const worktreeName = strOrNull(value.worktreeName);
  if (upstream === undefined || worktreeName === undefined) return null;

  const origin = parseRemote(value.origin);
  const upstreamRemote = parseRemote(value.upstreamRemote);
  const pr = parsePr(value.pr);
  if (origin === undefined || upstreamRemote === undefined || pr === undefined) return null;

  return Object.freeze({
    available: true,
    cwd,
    branch,
    detached: value.detached,
    sha,
    shortSha,
    status,
    diff,
    diffStaged,
    aheadBehind,
    upstream,
    origin,
    upstreamRemote,
    worktreeName,
    inWorktree: value.inWorktree,
    pr,
  });
}
