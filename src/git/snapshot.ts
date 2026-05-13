/**
 * `loadGitSnapshot(cwd)` — single resolver invoked once per render
 * tick. All `git -C <cwd> …` calls live here; widgets read from the
 * resulting snapshot and never shell out themselves (§1.2 N5, §7.6).
 *
 * A non-git directory yields `{ available: false }` so widgets hide
 * uniformly. Inside a repo, the loader gathers branch / sha / dirty
 * counts / ahead-behind / remote / worktree state in a fixed sequence;
 * each individual call may fail (no upstream, detached HEAD, missing
 * remote) without invalidating the rest of the snapshot.
 */

import { gitRun, type GitInvokeOptions } from "./invoke.js";
import {
  parseAheadBehind,
  parsePorcelain,
  parseRemoteUrl,
  parseShortstat,
  type AheadBehind,
  type PorcelainCounts,
  type RemoteRef,
  type Shortstat,
} from "./parse.js";
import { loadPullRequest, type GitPullRequestInfo } from "./pr.js";

export interface GitSnapshot {
  readonly available: true;
  readonly cwd: string;
  readonly branch: string;
  /** True when HEAD is detached. `branch` then carries the short SHA. */
  readonly detached: boolean;
  readonly sha: string;
  readonly shortSha: string;
  readonly status: PorcelainCounts;
  readonly diff: Shortstat;
  readonly diffStaged: Shortstat;
  readonly aheadBehind: AheadBehind;
  readonly upstream: string | null;
  readonly origin: RemoteRef | null;
  /** Detected `upstream` remote. `null` when no `upstream` remote configured. */
  readonly upstreamRemote: RemoteRef | null;
  readonly worktreeName: string | null;
  readonly inWorktree: boolean;
  /**
   * PR metadata for HEAD's branch. Populated only when the snapshot
   * loader was called with `allowPullRequest: true` (opt-in) and the
   * `gh` CLI returned a PR. `null` everywhere else: opt-out, no `gh`,
   * no PR, network failure. The `git-pr` widget reads this field and
   * hides cleanly when it's null.
   */
  readonly pr: GitPullRequestInfo | null;
}

export interface GitUnavailable {
  readonly available: false;
}

export type GitState = GitSnapshot | GitUnavailable;

export interface LoadGitSnapshotInput {
  readonly cwd: string | undefined;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  /**
   * When `true`, the loader additionally invokes `gh pr view` to
   * populate `snapshot.pr`. Defaults to `false` so the render hot
   * path and any incidental `loadGitSnapshot` caller stays free of
   * outbound `gh` calls. Callers that opt in (e.g. a future scan
   * detecting a `git-pr` widget on the configured lines) accept the
   * latency and silent-failure semantics documented in `pr.ts`.
   */
  readonly allowPullRequest?: boolean;
  /** Timeout for the `gh` lookup; defaults to `pr.ts`'s built-in. */
  readonly pullRequestTimeoutMs?: number;
}

export function loadGitSnapshot(input: LoadGitSnapshotInput): GitState {
  if (!input.cwd) return { available: false };
  const opts: GitInvokeOptions = {
    cwd: input.cwd,
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.env !== undefined ? { env: input.env } : {}),
  };

  if (gitRun(["rev-parse", "--is-inside-work-tree"], opts) !== "true") {
    return { available: false };
  }

  const sha = gitRun(["rev-parse", "HEAD"], opts) ?? "";
  const shortSha = gitRun(["rev-parse", "--short=7", "HEAD"], opts) ?? "";
  const headRef = gitRun(["rev-parse", "--abbrev-ref", "HEAD"], opts) ?? "";
  const detached = headRef === "HEAD" || headRef === "";
  const branch = detached ? shortSha : headRef;

  const status = parsePorcelain(gitRun(["status", "--porcelain=v1", "-uall"], opts));
  const diff = parseShortstat(gitRun(["diff", "--shortstat"], opts));
  const diffStaged = parseShortstat(gitRun(["diff", "--cached", "--shortstat"], opts));

  const upstream = gitRun(["rev-parse", "--abbrev-ref", "@{upstream}"], opts);
  const aheadBehind = parseAheadBehind(
    upstream === null
      ? null
      : gitRun(["rev-list", "--left-right", "--count", `${upstream}...HEAD`], opts),
  );

  const origin = parseRemoteUrl(gitRun(["remote", "get-url", "origin"], opts));
  const upstreamRemote = parseRemoteUrl(gitRun(["remote", "get-url", "upstream"], opts));

  const gitDir = gitRun(["rev-parse", "--git-dir"], opts) ?? "";
  const inWorktree = gitDir.includes("/worktrees/") || gitDir.includes("\\worktrees\\");
  let worktreeName: string | null = null;
  if (inWorktree) {
    const top = gitRun(["rev-parse", "--show-toplevel"], opts) ?? "";
    if (top) {
      const segs = top.replace(/\\/g, "/").split("/");
      worktreeName = segs[segs.length - 1] ?? null;
    }
  }

  const pr = input.allowPullRequest
    ? loadPullRequest({
        cwd: input.cwd,
        ...(input.env !== undefined ? { env: input.env } : {}),
        ...(input.pullRequestTimeoutMs !== undefined
          ? { timeoutMs: input.pullRequestTimeoutMs }
          : {}),
      })
    : null;

  return Object.freeze({
    available: true,
    cwd: input.cwd,
    branch,
    detached,
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
    inWorktree,
    pr,
  });
}
