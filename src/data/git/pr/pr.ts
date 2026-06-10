/**
 * Pull-request lookup via the `gh` CLI (§7.6 add-on, §1.2 N5 carve-out).
 *
 * This is the *only* module under `src/git/` that may shell out to a
 * binary other than `git`. It exists so the optional `git-pr` widget
 * has a place to read PR metadata for the current branch without the
 * widget itself doing I/O during `render()`. Two hard constraints:
 *
 *   1. The render hot path MUST NOT call this. Callers gate it behind
 *      an explicit opt-in (`allowPullRequest: true` on the snapshot
 *      loader, which itself is wired only outside `renderFromInputs`).
 *   2. Any failure — `gh` missing, no PR for the branch, network
 *      timeout, JSON shape change — yields `null`. Never throws.
 */

import { execFileSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 1_500;
const DEFAULT_BUFFER = 64 * 1024;

export interface GitPullRequestInfo {
  readonly number: number;
  readonly url: string;
  readonly title: string;
}

export interface LoadPullRequestOptions {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

/**
 * Outcome of a PR lookup, distinguishing a *transient* flake (the `gh`
 * call never produced a clean answer — timeout, missing binary, spawn
 * failure) from a *clean* result (`gh` ran and either reported a PR, no
 * PR, or an unparseable body). The snapshot loader holds last-known-good
 * PR data across a `transient` flake but lets a clean `null` (PR closed /
 * none for the branch) clear it — so a stale PR never lingers.
 *
 * Same `status`-based classification as `invoke.ts#gitRunOutcome`: a
 * non-zero exit (e.g. `gh pr view` when the branch has no PR) sets a
 * numeric `status`; a timeout / `ENOENT` does not.
 */
export interface PullRequestOutcome {
  readonly found: GitPullRequestInfo | null;
  readonly transient: boolean;
}

export function loadPullRequestOutcome(options: LoadPullRequestOptions): PullRequestOutcome {
  try {
    const stdout = execFileSync("gh", ["pr", "view", "--json", "number,url,title"], {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: DEFAULT_BUFFER,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "ignore"],
      env: options.env,
      windowsHide: true,
    });
    return { found: parsePullRequestJson(stdout), transient: false };
  } catch (err) {
    const status = (err as { status?: unknown }).status;
    // Numeric exit => gh ran and said "no PR"; otherwise it never ran cleanly.
    return { found: null, transient: typeof status !== "number" };
  }
}

/**
 * Best-effort PR lookup for HEAD's branch. Returns `null` when `gh`
 * isn't installed, the cwd isn't a repo, the branch has no PR, the
 * call times out, or the response can't be parsed. Errors are swallowed
 * silently — the widget hides on a `null` snapshot.
 */
export function loadPullRequest(options: LoadPullRequestOptions): GitPullRequestInfo | null {
  return loadPullRequestOutcome(options).found;
}

/**
 * Pure parser exported for tests — accepts the raw `gh pr view --json`
 * payload (or a malformed approximation thereof) and returns the
 * typed shape, or `null` on any structural mismatch.
 */
export function parsePullRequestJson(raw: string): GitPullRequestInfo | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const number = obj.number;
  const url = obj.url;
  const title = obj.title;
  if (typeof number !== "number" || !Number.isFinite(number) || number <= 0) return null;
  if (typeof url !== "string" || url.length === 0) return null;
  if (typeof title !== "string") return null;
  return Object.freeze({ number: Math.floor(number), url, title });
}
