/**
 * Pure parsers for git output (§7.6).
 *
 * Each parser tolerates `null` / empty input by returning the
 * documented zero shape — the snapshot loader never needs to
 * branch on absence vs. parse failure.
 */

export interface PorcelainCounts {
  readonly staged: number;
  readonly unstaged: number;
  readonly untracked: number;
  readonly conflicts: number;
  readonly modified: number;
  readonly added: number;
}

const ZERO_COUNTS: PorcelainCounts = Object.freeze({
  staged: 0,
  unstaged: 0,
  untracked: 0,
  conflicts: 0,
  modified: 0,
  added: 0,
});

const UNMERGED_SET: ReadonlySet<string> = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export function parsePorcelain(input: string | null): PorcelainCounts {
  if (!input) return ZERO_COUNTS;
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  let conflicts = 0;
  let modified = 0;
  let added = 0;
  for (const line of input.split("\n")) {
    if (line.length < 2) continue;
    const xy = line.slice(0, 2);
    if (xy === "??") {
      untracked += 1;
      continue;
    }
    if (UNMERGED_SET.has(xy)) {
      conflicts += 1;
      continue;
    }
    const x = xy.charAt(0);
    const y = xy.charAt(1);
    if (x !== " " && x !== "?") staged += 1;
    if (y !== " " && y !== "?") unstaged += 1;
    if (x === "M" || y === "M") modified += 1;
    if (x === "A" || y === "A") added += 1;
  }
  return { staged, unstaged, untracked, conflicts, modified, added };
}

export interface AheadBehind {
  readonly ahead: number;
  readonly behind: number;
}

export function parseAheadBehind(input: string | null): AheadBehind {
  if (!input) return { ahead: 0, behind: 0 };
  /*
   * `git rev-list --left-right --count UPSTREAM...HEAD` emits
   * `<behind>\t<ahead>` because LEFT is upstream, RIGHT is HEAD.
   */
  const parts = input.trim().split(/\s+/);
  const behind = parts[0] !== undefined ? toNonNegInt(parts[0]) : 0;
  const ahead = parts[1] !== undefined ? toNonNegInt(parts[1]) : 0;
  return { ahead, behind };
}

export interface Shortstat {
  readonly insertions: number;
  readonly deletions: number;
  readonly filesChanged: number;
}

export function parseShortstat(input: string | null): Shortstat {
  if (!input) return { insertions: 0, deletions: 0, filesChanged: 0 };
  // Example: ` 3 files changed, 12 insertions(+), 4 deletions(-)`.
  const filesMatch = input.match(/(\d+)\s+files?\s+changed/);
  const insMatch = input.match(/(\d+)\s+insertions?/);
  const delMatch = input.match(/(\d+)\s+deletions?/);
  return {
    filesChanged: filesMatch ? toNonNegInt(filesMatch[1]) : 0,
    insertions: insMatch ? toNonNegInt(insMatch[1]) : 0,
    deletions: delMatch ? toNonNegInt(delMatch[1]) : 0,
  };
}

export interface RemoteRef {
  readonly owner: string;
  readonly repo: string;
}

export function parseRemoteUrl(url: string | null): RemoteRef | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // SSH: `git@host:owner/repo(.git)?` or `ssh://git@host/owner/repo(.git)?`
  const ssh = trimmed.match(/^(?:ssh:\/\/)?[^@\s]+@[^:/\s]+[:/](.+?)(?:\.git)?\/?$/);
  if (ssh) {
    const path = ssh[1] ?? "";
    return splitOwnerRepo(path);
  }
  // HTTPS: `https://host/owner/repo(.git)?` (or http, or scp-like)
  const https = trimmed.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?\/?$/);
  if (https) {
    const path = https[1] ?? "";
    return splitOwnerRepo(path);
  }
  // Local path / git protocol fallback
  const slashed = trimmed.replace(/\.git\/?$/, "");
  return splitOwnerRepo(slashed);
}

function splitOwnerRepo(path: string): RemoteRef | null {
  const segments = path.replace(/^\/+/, "").split("/");
  if (segments.length < 2) return null;
  const repo = segments[segments.length - 1] ?? "";
  const owner = segments[segments.length - 2] ?? "";
  if (!owner || !repo) return null;
  return { owner, repo };
}

function toNonNegInt(value: string | undefined): number {
  if (value === undefined) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
