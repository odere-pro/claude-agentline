/**
 * Synchronous `git -C <cwd> …` wrapper used by the snapshot loader
 * (§7.6, §8.6).
 *
 * Every git invocation honours `-C cwd`, returns either trimmed
 * stdout or `null` on any failure, and trims trailing CR / LF so the
 * output is identical on Windows and POSIX hosts. We never inspect
 * stderr; a non-zero exit simply yields `null`.
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

export function gitRun(
  args: readonly string[],
  options: GitInvokeOptions,
): string | null {
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
    return trimCrlf(out);
  } catch {
    return null;
  }
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
