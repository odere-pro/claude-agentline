/**
 * Async tmpdir wrappers for tests that need a real filesystem sandbox.
 *
 * Closes the sync/async tmpdir variance the codebase has accumulated:
 * every test that needs a sandbox calls one of these and cleanup lives
 * in one place. Cleanup runs in `finally`, so a thrown assertion does
 * not leak the directory.
 */

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Remove a path recursively, tolerating the Windows handle-release race.
 *
 * On Windows a just-spawned subprocess (npm, or one of the atomic-write
 * node children the install scripts fork) can still hold a handle inside
 * `path` when cleanup runs, surfacing as `EBUSY`/`EPERM`/`ENOTEMPTY` from
 * `rmdir`. `fs.rm`'s `maxRetries`/`retryDelay` retries exactly those with
 * linear backoff — the canonical fix for the flake the install
 * integration suite intermittently hit on the `windows / node 20` leg.
 */
export function rmrf(path: string): Promise<void> {
  return fs.rm(path, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

/**
 * Allocate a tmpdir under the OS temp root, run `fn(dir)`, and remove
 * the directory afterwards. `prefix` is the agentline-conventional
 * `agentline-<purpose>-` so stragglers are greppable on disk if cleanup
 * is bypassed.
 */
export async function withTmpDir<T>(
  prefix: string,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rmrf(dir);
  }
}

/**
 * Allocate the standard `(home, cfgDir, cwd)` triple the CLI tests
 * exercise — three disjoint tmpdirs the same call cleans up. `home`
 * stands in for `$HOME`, `cfgDir` for `CLAUDE_CONFIG_DIR`, `cwd` for
 * the working directory the verb is run from.
 */
export async function withSandbox<T>(
  fn: (sandbox: { home: string; cfgDir: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const home = await fs.mkdtemp(join(tmpdir(), "agentline-home-"));
  const cfgDir = await fs.mkdtemp(join(tmpdir(), "agentline-cfg-"));
  const cwd = await fs.mkdtemp(join(tmpdir(), "agentline-cwd-"));
  try {
    return await fn({ home, cfgDir, cwd });
  } finally {
    await Promise.all([rmrf(home), rmrf(cfgDir), rmrf(cwd)]);
  }
}
