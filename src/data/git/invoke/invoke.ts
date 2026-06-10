/**
 * Synchronous `git -C <cwd> …` wrapper used by the snapshot loader
 * (§7.6, §8.6).
 *
 * Every git invocation honours `-C cwd`, returns trimmed stdout on
 * success and trims trailing CR / LF so the output is identical on
 * Windows and POSIX hosts. We never inspect stderr.
 *
 * Two failure shapes are deliberately distinguished by `gitRunOutcome`:
 *
 *   - **`exit`** — git ran and exited non-zero (no upstream, no remote,
 *     detached HEAD, not a repo). This is a *genuine* "the answer is no",
 *     identified by a numeric `status` on the thrown error.
 *   - **`transient`** — the process never produced a clean answer:
 *     timeout, missing `git` binary (`ENOENT`), buffer overflow, or any
 *     other spawn failure. The thrown error carries a `code`/`signal`
 *     but no numeric `status`.
 *
 * The snapshot loader uses this distinction to hold last-known-good data
 * across a transient miss (which is what kills the flicker) while still
 * honouring a genuine change reported by a clean non-zero exit. The
 * legacy `gitRun` wrapper flattens both to `null` for callers that don't
 * care about the reason.
 *
 * Direct `execFileSync` keeps argv quoting under our control — no
 * shell interpolation, no PATH games beyond what the host already
 * has. Per spec we MUST NOT shell-out to anything other than git.
 */

import { execFileSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 250;
const DEFAULT_BUFFER = 1024 * 1024;

export interface GitInvokeOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Result of a single git invocation. `ok` carries the trimmed stdout;
 * a failure carries the classified `reason` (see the module header).
 */
export type GitOutcome =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: "exit" | "transient" };

export function gitRunOutcome(args: readonly string[], options: GitInvokeOptions): GitOutcome {
  const argv = ["-C", options.cwd, ...args];
  try {
    const out = execFileSync("git", argv, {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: DEFAULT_BUFFER,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "ignore"],
      env: options.env,
      windowsHide: true,
    });
    return { ok: true, value: trimCrlf(out) };
  } catch (err) {
    /*
     * `execFileSync` sets a numeric `status` only when git actually ran
     * and returned a non-zero exit code. Timeouts, a missing binary,
     * buffer overflow, and other spawn failures leave `status` null/
     * undefined and surface via `code`/`signal` instead — those are the
     * transient cases we hold last-known-good data through.
     */
    const status = (err as { status?: unknown }).status;
    return { ok: false, reason: typeof status === "number" ? "exit" : "transient" };
  }
}

export function gitRun(args: readonly string[], options: GitInvokeOptions): string | null {
  const outcome = gitRunOutcome(args, options);
  return outcome.ok ? outcome.value : null;
}

export function trimCrlf(value: string): string {
  let end = value.length;
  while (end > 0) {
    const c = value.charCodeAt(end - 1);
    if (c !== 0x0a && c !== 0x0d) break;
    end -= 1;
  }
  return value.slice(0, end);
}
