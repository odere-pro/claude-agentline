/**
 * Semver comparison shared by the update-check and claude-health refreshers.
 *
 * Lives in `core` so both `src/commands/update-check` and
 * `src/commands/claude-health` can import it without crossing the
 * "data imports from core only / commands import from core+data" layering
 * (gate-25). The version-check doctor check (D07) imports `isNewer` via the
 * `update-check/refresh` re-export, which now forwards here.
 *
 * The comparator treats prerelease and metadata tags as lower priority than
 * the bare `MAJOR.MINOR.PATCH` triplet, and yields `false` for anything it
 * cannot parse — better to under-report an upgrade than to cry wolf from a
 * parse mismatch.
 */

export interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
}

/**
 * Parse a `MAJOR.MINOR.PATCH[-prerelease][+build]` string, tolerating a
 * leading `v`. Returns `null` when the input is not a clean semver triplet.
 */
export function parseSemver(input: string): ParsedSemver | null {
  const trimmed = input.trim().replace(/^v/, "");
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(trimmed);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10),
    prerelease: match[4] ?? null,
  };
}

/**
 * Semver-aware comparator that treats prerelease and metadata tags as
 * lower priority than the bare `MAJOR.MINOR.PATCH` triplet.
 *
 *   `0.1.0`        < `0.2.0`        → true
 *   `0.1.0-alpha`  < `0.1.0`        → true
 *   `0.1.0`        < `0.1.0`        → false
 *
 * Anything we can't parse (registry oddities, locally-patched dev
 * builds) yields `false` — better to under-report an upgrade than to
 * cry wolf from a parse mismatch.
 */
export function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  if (a.patch !== b.patch) return a.patch > b.patch;
  /*
   * Same numeric triplet: stable beats prerelease, prereleases compare
   * lexicographically (rough but sufficient for "0.1.0-rc.2 > 0.1.0-rc.1").
   */
  if (a.prerelease === null && b.prerelease !== null) return true;
  if (a.prerelease !== null && b.prerelease === null) return false;
  if (a.prerelease === null && b.prerelease === null) return false;
  return (a.prerelease as string) > (b.prerelease as string);
}
