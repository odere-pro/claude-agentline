/**
 * Last-render cache (Memento for the previous statusline output).
 *
 * Every successful live render writes the rendered ANSI output to
 * `${agentlineConfigDir}/state/last-render.json` (atomic, write-temp +
 * fsync + rename — same pattern as `config/atomic.ts` and the sibling
 * `stdin-cache.ts`).
 *
 * Uses:
 *   - `agentline uninstall` shows the last render to the user before
 *     removing agentline, so they have a parting view of what was on
 *     screen. The file survives a non-purge uninstall (it lives under
 *     `${CLAUDE_CONFIG_DIR:-~/.config}/agentline/state/`, which is
 *     agentline's state dir, not the host settings file) so a
 *     subsequent `agentline install` can reference it as a "restore"
 *     hint.
 *   - Debug / diagnostic surfaces can compare two consecutive renders
 *     or replay the last output without rerunning the pipeline.
 *
 * Contract:
 *   - Write happens only on the live render path (no `--fixture`, no
 *     `--config`). Replays and goldens stay deterministic.
 *   - Failures are swallowed silently. The render must never fail
 *     because the cache couldn't be written — the user can't see the
 *     error and the cache is best-effort.
 *   - Read is synchronous so the uninstall command can show it without
 *     waiting on async I/O.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeJsonIdempotent } from "../lib/atomic-write.js";
import { isPlainObject } from "../lib/object.js";

export const RENDER_CACHE_VERSION = 1 as const;

export interface RenderCacheMeta {
  readonly width?: number;
  readonly lineCount?: number;
}

export interface CachedRender {
  readonly version: typeof RENDER_CACHE_VERSION;
  readonly savedAt: string;
  readonly rendered: string;
  readonly meta: RenderCacheMeta;
}

export interface RenderCachePaths {
  readonly stateDir: string;
  readonly cacheFile: string;
}

/**
 * Resolve the cache directory under the agentline config dir. Honours
 * `$CLAUDE_CONFIG_DIR` so the editor, the bin, and the uninstall
 * command see the same file regardless of where the user has placed
 * their config.
 */
export function resolveRenderCachePaths(env: NodeJS.ProcessEnv = process.env): RenderCachePaths {
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir = cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const stateDir = join(agentlineDir, "state");
  return { stateDir, cacheFile: join(stateDir, "last-render.json") };
}

/**
 * Persist the most recent rendered output. Best-effort: errors (e.g.
 * read-only home, permission denied) are swallowed so a broken cache
 * dir never breaks the user's statusline.
 */
export async function saveLastRender(
  rendered: string,
  args: {
    readonly meta?: RenderCacheMeta;
    readonly env?: NodeJS.ProcessEnv;
    readonly clock?: () => Date;
  } = {},
): Promise<void> {
  const { cacheFile } = resolveRenderCachePaths(args.env ?? process.env);
  const body: CachedRender = {
    version: RENDER_CACHE_VERSION,
    savedAt: (args.clock ?? (() => new Date()))().toISOString(),
    rendered,
    meta: args.meta ?? {},
  };
  try {
    await writeJsonIdempotent(cacheFile, body, { mode: 0o600, dirMode: 0o700 });
  } catch {
    // Silently swallow — the user can't see this error and the cache
    // is best-effort. The render path is unaffected.
  }
}

/**
 * Read the cached render synchronously. Returns `null` when the file
 * is absent, unreadable, malformed, or carries an unknown version.
 */
export function readLastRenderSync(env: NodeJS.ProcessEnv = process.env): CachedRender | null {
  const { cacheFile } = resolveRenderCachePaths(env);
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
  if (parsed.version !== RENDER_CACHE_VERSION) return null;
  if (typeof parsed.rendered !== "string") return null;
  const meta = parsed.meta;
  const safeMeta: RenderCacheMeta = isPlainObject(meta)
    ? {
        width: typeof meta.width === "number" ? meta.width : undefined,
        lineCount: typeof meta.lineCount === "number" ? meta.lineCount : undefined,
      }
    : {};
  return {
    version: RENDER_CACHE_VERSION,
    savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    rendered: parsed.rendered,
    meta: safeMeta,
  };
}
