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
    await fs.rm(dir, { recursive: true, force: true });
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
    await Promise.all([
      fs.rm(home, { recursive: true, force: true }),
      fs.rm(cfgDir, { recursive: true, force: true }),
      fs.rm(cwd, { recursive: true, force: true }),
    ]);
  }
}
