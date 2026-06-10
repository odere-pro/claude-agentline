/**
 * `loadGitSnapshot(cwd)` — single resolver invoked once per render
 * tick. All `git -C <cwd> …` calls live here; widgets read from the
 * resulting snapshot and never shell out themselves (§1.2 N5, §7.6).
 *
 * A non-git directory yields `{ available: false }` so widgets hide
 * uniformly. Inside a repo, the loader gathers branch / sha / dirty
 * counts / ahead-behind / remote / worktree state; each individual
 * call may fail (no upstream, detached HEAD, missing remote) without
 * invalidating the rest of the snapshot.
 *
 * ## Last-known-good fallback (anti-flicker)
 *
 * agentline runs as a fresh process per statusline tick, so a single
 * slow tick that times out a `git` call used to collapse a field to
 * empty (branch → SHA → hidden, worktree hidden, dirty → clean) and the
 * next fast tick would restore it — the visible flicker. The loader now
 * accepts the previous tick's snapshot (`input.previous`, supplied by
 * the live render path from the on-disk git-snapshot cache) and, when a
 * call fails *transiently* (timeout / spawn failure — see `invoke.ts`),
 * reuses the last-known-good value for that field instead of blanking
 * it. A *genuine* non-zero exit (no upstream, not a repo) still updates
 * to the fresh answer, so real changes are never masked.
 *
 * The loader itself remains pure and disk-free: the caller reads/writes
 * the cache and injects `previous`, so unit tests exercise the fallback
 * by passing a snapshot directly. With `previous` absent (the default),
 * behaviour matches the original blank-on-failure semantics.
 *
 * ## Spawn count
 *
 * `git rev-parse` prints one line per argument, so the HEAD trio
 * (full SHA + branch) and the worktree pair (git-dir + toplevel) each
 * collapse into a single invocation — fewer spawns per tick means a
 * smaller transient-failure surface.
 */

import { gitRunOutcome, type GitInvokeOptions, type GitOutcome } from "../invoke/invoke.js";
import {
  parseAheadBehind,
  parsePorcelain,
  parseRemoteUrl,
  parseShortstat,
  type AheadBehind,
  type PorcelainCounts,
  type RemoteRef,
  type Shortstat,
} from "../parse/parse.js";
import { loadPullRequestOutcome, type GitPullRequestInfo } from "../pr/pr.js";

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
  /**
   * Last-known-good snapshot for this `cwd` (from the git-snapshot
   * cache). When a `git` call fails *transiently*, the matching field
   * falls back to this value instead of blanking — the anti-flicker
   * path. `null`/absent (the default and every fixture/unit path) keeps
   * the original blank-on-failure behaviour.
   */
  readonly previous?: GitSnapshot | null;
}

/**
 * Resolve one snapshot field from a git outcome:
 *   - success   → parse the fresh output;
 *   - `exit`    → genuine absence; parse the empty value (real change);
 *   - `transient` → reuse last-known-good when present, else empty.
 *
 * Exported for unit tests — the three-way branch is the heart of the
 * anti-flicker behaviour and is awkward to force deterministically
 * through the full loader.
 */
export function resolveField<T>(
  outcome: GitOutcome,
  parse: (raw: string | null) => T,
  previous: T | undefined,
): T {
  if (outcome.ok) return parse(outcome.value);
  if (outcome.reason === "transient" && previous !== undefined) return previous;
  return parse(null);
}

export function loadGitSnapshot(input: LoadGitSnapshotInput): GitState {
  if (!input.cwd) return { available: false };
  const opts: GitInvokeOptions = {
    cwd: input.cwd,
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.env !== undefined ? { env: input.env } : {}),
  };
  const prev = input.previous ?? null;

  const inside = gitRunOutcome(["rev-parse", "--is-inside-work-tree"], opts);
  if (!(inside.ok && inside.value === "true")) {
    // A transient miss with a prior snapshot holds last-known-good rather
    // than flickering the whole git family off. A genuine non-repo (clean
    // non-zero exit) or `false` still hides uniformly.
    if (!inside.ok && inside.reason === "transient" && prev) return prev;
    return { available: false };
  }

  // HEAD trio in one spawn: line 0 = full SHA, line 1 = branch (or "HEAD"
  // when detached). Short SHA is the 7-char prefix (== `--short=7`).
  const head = gitRunOutcome(["rev-parse", "HEAD", "--abbrev-ref", "HEAD"], opts);
  let sha: string;
  let shortSha: string;
  let branch: string;
  let detached: boolean;
  if (head.ok) {
    const lines = head.value.split("\n");
    sha = (lines[0] ?? "").trim();
    const headRef = (lines[1] ?? "").trim();
    shortSha = sha.slice(0, 7);
    detached = headRef === "HEAD" || headRef === "";
    branch = detached ? shortSha : headRef;
  } else if (head.reason === "transient" && prev) {
    ({ sha, shortSha, branch, detached } = prev);
  } else {
    sha = "";
    shortSha = "";
    detached = true;
    branch = "";
  }

  const status = resolveField(
    gitRunOutcome(["status", "--porcelain=v1", "-uall"], opts),
    parsePorcelain,
    prev?.status,
  );
  const diff = resolveField(gitRunOutcome(["diff", "--shortstat"], opts), parseShortstat, prev?.diff);
  const diffStaged = resolveField(
    gitRunOutcome(["diff", "--cached", "--shortstat"], opts),
    parseShortstat,
    prev?.diffStaged,
  );

  const upstreamOutcome = gitRunOutcome(["rev-parse", "--abbrev-ref", "@{upstream}"], opts);
  const upstream = resolveField(
    upstreamOutcome,
    (raw) => (raw === null || raw === "" ? null : raw),
    prev?.upstream,
  );
  const aheadBehind = resolveField(
    upstream === null
      ? { ok: true, value: "" }
      : gitRunOutcome(["rev-list", "--left-right", "--count", `${upstream}...HEAD`], opts),
    parseAheadBehind,
    prev?.aheadBehind,
  );

  const origin = resolveField(
    gitRunOutcome(["remote", "get-url", "origin"], opts),
    parseRemoteUrl,
    prev?.origin,
  );
  const upstreamRemote = resolveField(
    gitRunOutcome(["remote", "get-url", "upstream"], opts),
    parseRemoteUrl,
    prev?.upstreamRemote,
  );

  // Worktree pair in one spawn: line 0 = git-dir, line 1 = toplevel.
  const worktree = gitRunOutcome(["rev-parse", "--git-dir", "--show-toplevel"], opts);
  let inWorktree: boolean;
  let worktreeName: string | null;
  if (worktree.ok) {
    const lines = worktree.value.split("\n");
    const gitDir = (lines[0] ?? "").trim();
    inWorktree = gitDir.includes("/worktrees/") || gitDir.includes("\\worktrees\\");
    worktreeName = null;
    if (inWorktree) {
      const top = (lines[1] ?? "").trim();
      if (top) {
        const segs = top.replace(/\\/g, "/").split("/");
        worktreeName = segs[segs.length - 1] ?? null;
      }
    }
  } else if (worktree.reason === "transient" && prev) {
    inWorktree = prev.inWorktree;
    worktreeName = prev.worktreeName;
  } else {
    inWorktree = false;
    worktreeName = null;
  }

  let pr: GitPullRequestInfo | null = null;
  if (input.allowPullRequest) {
    const outcome = loadPullRequestOutcome({
      cwd: input.cwd,
      ...(input.env !== undefined ? { env: input.env } : {}),
      ...(input.pullRequestTimeoutMs !== undefined
        ? { timeoutMs: input.pullRequestTimeoutMs }
        : {}),
    });
    // Hold last-known-good only on a transient flake; a clean "no PR"
    // (PR closed/merged) clears it so the widget never shows a stale PR.
    pr = outcome.transient ? (prev?.pr ?? null) : outcome.found;
  }

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
