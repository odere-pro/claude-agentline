/**
 * Public surface of the git data layer (§7.6).
 *
 * `loadGitSnapshot` is invoked once per render tick by the dispatcher;
 * widgets read the resulting `GitSnapshot` via `ctx.git`. The module
 * performs no host-state mutation and never reads the filesystem
 * directly — every call goes through `git -C <cwd>`.
 */

export { gitRun, trimCrlf } from "./invoke.js";
export {
  parseAheadBehind,
  parsePorcelain,
  parseRemoteUrl,
  parseShortstat,
  type AheadBehind,
  type PorcelainCounts,
  type RemoteRef,
  type Shortstat,
} from "./parse.js";
export {
  loadGitSnapshot,
  type GitSnapshot,
  type GitState,
  type GitUnavailable,
  type LoadGitSnapshotInput,
} from "./snapshot.js";
