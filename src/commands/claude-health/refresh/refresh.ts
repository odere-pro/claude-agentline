/**
 * `maybeRefreshClaudeHealth` — refresh the claude-health cache when it is
 * stale or absent. Spawns `claude --version` / `claude doctor` and probes
 * npm for the latest `@anthropic-ai/claude-code`, then writes a frozen
 * summary to the cache.
 *
 * Called off the render path: by doctor's D10 check (awaited, for an
 * accurate report) and by the detached `__refresh-claude-health` process
 * the live render spawns when the cache is stale. **Never** runs on the
 * render hot path itself (gate 13 / gate 14).
 *
 * Cache TTL is 24h, mirroring update-check: a probe that completed within
 * the last day is trusted; a failed probe is also held for the TTL window
 * so a CLI-less host isn't re-probed on every render.
 *
 * Contract: never throws — every failure path returns silently.
 */

import {
  CLAUDE_HEALTH_TTL_MS,
  readClaudeHealthSync,
  saveClaudeHealth,
  type ClaudeHealthCache,
} from "../../../data/state/claude-health-cache/claude-health-cache.js";
import { isNewer } from "../../../core/lib/semver/semver.js";
import { fetchLatestVersion, type FetchLatestVersionOptions } from "../../update-check/fetch/fetch.js";
import { runClaudeDoctor, runClaudeVersion, type ClaudeInvokeOptions } from "../invoke/invoke.js";
import { parseClaudeDoctor, parseClaudeVersion } from "../parse/parse.js";

const CLAUDE_PACKAGE = "@anthropic-ai/claude-code";

export type ClaudeHealthRefreshOutcome =
  | { readonly kind: "skipped-fresh"; readonly cache: ClaudeHealthCache }
  | { readonly kind: "refreshed"; readonly cache: ClaudeHealthCache };

export interface MaybeRefreshClaudeHealthOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly now?: number;
  readonly ttlMs?: number;
  /** Forces a refresh even when the cache is within TTL. */
  readonly force?: boolean;
  /** Test seam — npm fetch options (package defaults to the Claude CLI). */
  readonly fetchOptions?: FetchLatestVersionOptions;
  /** Test seam — override the `claude` invocation. */
  readonly invoke?: {
    readonly version?: (opts: ClaudeInvokeOptions) => string | null;
    readonly doctor?: (opts: ClaudeInvokeOptions) => string | null;
  };
}

export async function maybeRefreshClaudeHealth(
  options: MaybeRefreshClaudeHealthOptions = {},
): Promise<ClaudeHealthRefreshOutcome> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? CLAUDE_HEALTH_TTL_MS;

  const existing = readClaudeHealthSync(env);
  if (!options.force && existing && isFresh(existing.savedAt, now, ttl)) {
    return { kind: "skipped-fresh", cache: existing };
  }

  const versionFn = options.invoke?.version ?? runClaudeVersion;
  const doctorFn = options.invoke?.doctor ?? runClaudeDoctor;

  const cliVersion = parseClaudeVersion(versionFn({ env }));
  const doctor = parseClaudeDoctor(doctorFn({ env }));
  const fetched = await fetchLatestVersion({
    package: CLAUDE_PACKAGE,
    ...options.fetchOptions,
  });
  /*
   * Preserve a prior successful `latestVersion` if this probe failed —
   * a stale success beats clobbering with `null` (mirrors update-check).
   */
  const latestVersion = fetched ?? existing?.latestVersion ?? null;
  const needsUpdate =
    cliVersion !== null && latestVersion !== null ? isNewer(latestVersion, cliVersion) : false;

  const entry: Omit<ClaudeHealthCache, "version"> = {
    savedAt: new Date(now).toISOString(),
    cliVersion,
    latestVersion,
    needsUpdate,
    doctor,
  };
  await saveClaudeHealth(entry, env);
  return { kind: "refreshed", cache: { version: 1, ...entry } };
}

function isFresh(savedAtIso: string, now: number, ttlMs: number): boolean {
  const savedAt = Date.parse(savedAtIso);
  if (!Number.isFinite(savedAt)) return false;
  return now - savedAt < ttlMs;
}
