/**
 * Frozen Claude-CLI health snapshot.
 *
 * A thin wrapper over `readClaudeHealthSync` that maps an absent / unreadable
 * cache to `{ available: false }`, matching the "unpopulated cache → pass"
 * behaviour in doctor D10.
 * Pattern: **Frozen snapshot for I/O resolvers** (`docs/cookbook/05-design-patterns.md`).
 */

import {
  readClaudeHealthSync,
  type ClaudeDoctorSummary,
} from "./claude-health-cache.js";

export type ClaudeHealthState =
  | { readonly available: false }
  | {
      readonly available: true;
      readonly cliVersion: string | null;
      readonly latestVersion: string | null;
      readonly needsUpdate: boolean;
      readonly doctor: ClaudeDoctorSummary | null;
    };

const UNAVAILABLE: ClaudeHealthState = Object.freeze({ available: false });

export interface LoadClaudeHealthSnapshotInput {
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Read the claude-health cache into a frozen snapshot. Returns
 * `{ available: false }` when the cache is missing — never throws.
 */
export function loadClaudeHealthSnapshot(
  input: LoadClaudeHealthSnapshotInput = {},
): ClaudeHealthState {
  const cache = readClaudeHealthSync(input.env);
  if (cache === null) return UNAVAILABLE;
  return Object.freeze({
    available: true,
    cliVersion: cache.cliVersion,
    latestVersion: cache.latestVersion,
    needsUpdate: cache.needsUpdate,
    doctor: cache.doctor,
  });
}
