/**
 * Cache for the most recent Claude-CLI health probe.
 *
 * Lives under `${agentlineDir}/state/claude-health.json`, written by the
 * off-render-path refresher (`src/commands/claude-health/refresh`) after
 * spawning `claude --version` / `claude doctor` and probing npm for the
 * latest `@anthropic-ai/claude-code`. Read synchronously by doctor's D10
 * check after the inline self-refresh.
 *
 * Contract — writers:
 *   - Atomic write (write-temp + fsync + rename) via `writeJsonIdempotent`
 *     — same pattern as `version-check-cache.ts`. Failures are swallowed
 *     (best-effort).
 *
 * Contract — readers:
 *   - Sync read; returns `null` on any failure (missing file, malformed
 *     JSON, unknown version, missing required fields). Absence is never
 *     an error — D10 reports `pass` with an explanation in that case.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { isPlainObject } from "../../../core/lib/object/object.js";

export const CLAUDE_HEALTH_CACHE_VERSION = 1 as const;

/** Probe freshness window — shared by the refresher and the render-path trigger. */
export const CLAUDE_HEALTH_TTL_MS = 24 * 60 * 60 * 1000;

export type ClaudeDoctorStatus = "ok" | "warn" | "fail" | "unknown";

export interface ClaudeDoctorSummary {
  /** Overall verdict from `claude doctor` (best-effort). */
  readonly status: ClaudeDoctorStatus;
  /** Best-effort count of error/issue lines. */
  readonly issues: number;
  /** Best-effort count of warning lines. */
  readonly warnings: number;
}

export interface ClaudeHealthCache {
  readonly version: typeof CLAUDE_HEALTH_CACHE_VERSION;
  /** ISO timestamp of the last completed probe. */
  readonly savedAt: string;
  /** Installed CLI version from `claude --version`, or `null` when absent. */
  readonly cliVersion: string | null;
  /** Latest `@anthropic-ai/claude-code` from npm, or `null` when the probe failed. */
  readonly latestVersion: string | null;
  /** Derived `isNewer(latest, cli)` — stored so widgets stay pure (no comparison at render). */
  readonly needsUpdate: boolean;
  /** `claude doctor` summary, or `null` when it could not be run/parsed. */
  readonly doctor: ClaudeDoctorSummary | null;
}

export interface ClaudeHealthCachePaths {
  readonly stateDir: string;
  readonly cacheFile: string;
}

/**
 * Resolve the cache file under the agentline config dir. Honours
 * `$CLAUDE_CONFIG_DIR` so install, doctor, edit, the render path, and any
 * tooling that shares the agentline state directory see the same file.
 */
export function resolveClaudeHealthPaths(
  env: NodeJS.ProcessEnv = process.env,
): ClaudeHealthCachePaths {
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir = cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const stateDir = join(agentlineDir, "state");
  return { stateDir, cacheFile: join(stateDir, "claude-health.json") };
}

/**
 * Persist the result of a health probe. Best-effort — errors (read-only
 * home, permission denied, EXDEV on cross-mount renames) are swallowed so
 * a broken cache dir never breaks the refresher / doctor.
 */
export async function saveClaudeHealth(
  entry: Omit<ClaudeHealthCache, "version">,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { cacheFile } = resolveClaudeHealthPaths(env);
  const body: ClaudeHealthCache = { version: CLAUDE_HEALTH_CACHE_VERSION, ...entry };
  try {
    await writeJsonIdempotent(cacheFile, body, { mode: 0o600, dirMode: 0o700 });
  } catch {
    /* Best-effort — the caller proceeds as if the write succeeded. */
  }
}

function parseDoctor(value: unknown): ClaudeDoctorSummary | null {
  if (value === null) return null;
  if (!isPlainObject(value)) return null;
  const { status, issues, warnings } = value;
  if (status !== "ok" && status !== "warn" && status !== "fail" && status !== "unknown") {
    return null;
  }
  if (typeof issues !== "number" || !Number.isFinite(issues)) return null;
  if (typeof warnings !== "number" || !Number.isFinite(warnings)) return null;
  return { status, issues, warnings };
}

/**
 * Read the cached probe synchronously. Returns `null` when the file is
 * absent, unreadable, malformed, or carries an unknown version.
 */
export function readClaudeHealthSync(
  env: NodeJS.ProcessEnv = process.env,
): ClaudeHealthCache | null {
  const { cacheFile } = resolveClaudeHealthPaths(env);
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
  if (parsed.version !== CLAUDE_HEALTH_CACHE_VERSION) return null;
  if (typeof parsed.savedAt !== "string") return null;
  if (parsed.cliVersion !== null && typeof parsed.cliVersion !== "string") return null;
  if (parsed.latestVersion !== null && typeof parsed.latestVersion !== "string") return null;
  if (typeof parsed.needsUpdate !== "boolean") return null;
  const doctor = parseDoctor(parsed.doctor);
  if (parsed.doctor !== null && doctor === null) return null;
  return {
    version: CLAUDE_HEALTH_CACHE_VERSION,
    savedAt: parsed.savedAt,
    cliVersion: parsed.cliVersion,
    latestVersion: parsed.latestVersion,
    needsUpdate: parsed.needsUpdate,
    doctor,
  };
}

/**
 * Whether the cached probe is still within the freshness window. Used by
 * the refresher to short-circuit a redundant probe. A missing / undated
 * cache is treated as stale.
 */
export function isClaudeHealthFresh(
  now: number,
  env: NodeJS.ProcessEnv = process.env,
  ttlMs: number = CLAUDE_HEALTH_TTL_MS,
): boolean {
  const cache = readClaudeHealthSync(env);
  if (cache === null) return false;
  const savedAt = Date.parse(cache.savedAt);
  return Number.isFinite(savedAt) && now - savedAt < ttlMs;
}
