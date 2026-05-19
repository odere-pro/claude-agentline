/**
 * Public surface of the git data layer (§7.6).
 *
 * `loadGitSnapshot` is invoked once per render tick by the dispatcher;
 * widgets read the resulting `GitSnapshot` via `ctx.git`. The module
 * performs no host-state mutation and never reads the filesystem
 * directly — every call goes through `git -C <cwd>`.
 */

export type { GitSnapshot, GitState } from "./snapshot.js";
