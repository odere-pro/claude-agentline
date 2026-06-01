/**
 * `maybeRefresh` — refresh the version-check cache when it is stale or
 * absent. Called fire-and-forget from `install`, `edit`, and `doctor`.
 *
 * Cache TTL is 24h: a probe that completed within the last day is
 * skipped (we trust the previous answer). A failed probe is also
 * skipped for 24h to avoid hammering the registry from a host that
 * has lost network.
 *
 * Contract:
 *   - Never throws — every failure path returns silently.
 *   - Resolves to a discriminator so callers can render a "yes,
 *     checked, here's the result" message when they want one
 *     (`doctor` does; `install` and `edit` ignore the return value).
 */

import { AGENTLINE_VERSION } from "../../../version.js";
import {
  readVersionCheckSync,
  saveVersionCheck,
  type VersionCheckCache,
} from "../../../data/state/version-check-cache/version-check-cache.js";
import { fetchLatestVersion, type FetchLatestVersionOptions } from "../fetch/fetch.js";

/**
 * `isNewer` now lives in `core` so the claude-health refresher can share it.
 * Re-exported here so existing importers (doctor D07) keep their import path.
 */
export { isNewer } from "../../../core/lib/semver/semver.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type RefreshOutcome =
  | { readonly kind: "skipped-fresh"; readonly cache: VersionCheckCache }
  | { readonly kind: "refreshed"; readonly cache: VersionCheckCache }
  | { readonly kind: "fetch-failed"; readonly cache: VersionCheckCache | null };

export interface MaybeRefreshOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly now?: number;
  readonly ttlMs?: number;
  readonly currentVersion?: string;
  readonly fetchOptions?: FetchLatestVersionOptions;
  /** Forces a refresh even when the cache is within TTL. */
  readonly force?: boolean;
}

export async function maybeRefresh(options: MaybeRefreshOptions = {}): Promise<RefreshOutcome> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? CACHE_TTL_MS;
  const current = options.currentVersion ?? AGENTLINE_VERSION;

  const existing = readVersionCheckSync(env);
  if (!options.force && existing && isFresh(existing.savedAt, now, ttl)) {
    return { kind: "skipped-fresh", cache: existing };
  }

  const latest = await fetchLatestVersion(options.fetchOptions);
  if (latest === null) {
    /*
     * Persist the failed probe so we don't re-hammer the registry on
     * every install/doctor invocation for the next TTL window. The
     * existing cache (if any) keeps its prior `latest` value — a stale
     * success beats clobbering with a fresh `null`.
     */
    if (!existing) {
      const failed: VersionCheckCache = {
        version: 1,
        savedAt: new Date(now).toISOString(),
        current,
        latest: null,
      };
      await saveVersionCheck(
        { savedAt: failed.savedAt, current: failed.current, latest: failed.latest },
        env,
      );
      return { kind: "fetch-failed", cache: failed };
    }
    return { kind: "fetch-failed", cache: existing };
  }

  const refreshed: VersionCheckCache = {
    version: 1,
    savedAt: new Date(now).toISOString(),
    current,
    latest,
  };
  await saveVersionCheck(
    { savedAt: refreshed.savedAt, current: refreshed.current, latest: refreshed.latest },
    env,
  );
  return { kind: "refreshed", cache: refreshed };
}

function isFresh(savedAtIso: string, now: number, ttlMs: number): boolean {
  const savedAt = Date.parse(savedAtIso);
  if (!Number.isFinite(savedAt)) return false;
  return now - savedAt < ttlMs;
}
