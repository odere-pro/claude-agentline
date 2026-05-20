/**
 * Cross-process advisory file lock for atomic config / settings writes.
 *
 * Two agentline invocations that both load-mutate-write the same JSON
 * file (e.g. `config widget add` racing `config refresh`, or any CLI
 * verb overlapping the TUI editor's background save) can clobber each
 * other's changes: writer A reads, writer B reads + writes, writer A
 * writes — A's mutation is silently lost. `withFileLock` serialises
 * those critical sections on a per-path basis using an `O_EXCL` lockfile
 * at `<path>.lock` so only one writer holds the lock at a time.
 *
 * Stale-lock recovery: a lockfile whose owning PID is no longer alive
 * (process crashed without releasing) is force-removed after the
 * `STALE_LOCK_MS` window so a crashed predecessor cannot wedge every
 * future write indefinitely. The lockfile's body is the owner's PID, so
 * liveness check is `process.kill(pid, 0)` — non-portable to Windows
 * but agentline is POSIX-only at runtime (Node ≥ 20 on darwin/linux).
 *
 * Render-hot-path note: this module is never imported by the render
 * path. Locks are taken only by persistence callers (config mutations,
 * settings.json refresh sync), so the cold-start budget is unaffected.
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";

const POLL_INTERVAL_MS = 50;
const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_MS = 30_000;
const FORCE_OWNER = "test-force";

interface FileLockOptions {
  /** Override the wait-for-lock timeout. Tests use a tiny value. */
  readonly timeoutMs?: number;
  /**
   * Test-only seam: when set, the function uses this string as the lock
   * body and treats *every* existing lock as stale (skipping PID
   * liveness). The runtime path never sets this.
   */
  readonly testForceTakeover?: boolean;
}

export async function withFileLock<T>(
  targetPath: string,
  fn: () => Promise<T>,
  opts: FileLockOptions = {},
): Promise<T> {
  const lockPath = `${targetPath}.lock`;
  await fs.mkdir(dirname(lockPath), { recursive: true });
  const owner = opts.testForceTakeover ? FORCE_OWNER : String(process.pid);
  const timeoutMs = opts.timeoutMs ?? LOCK_TIMEOUT_MS;
  await acquireLock(lockPath, owner, timeoutMs, Boolean(opts.testForceTakeover));
  try {
    return await fn();
  } finally {
    await fs.unlink(lockPath).catch(() => undefined);
  }
}

async function acquireLock(
  lockPath: string,
  owner: string,
  timeoutMs: number,
  treatAllAsStale: boolean,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fh = await fs.open(lockPath, "wx", 0o600);
      try {
        await fh.writeFile(owner);
      } finally {
        await fh.close();
      }
      return;
    } catch (err) {
      if (!isEexist(err)) throw err;
    }
    if (await tryClearStaleLock(lockPath, treatAllAsStale)) continue;
    if (Date.now() >= deadline) {
      throw new Error(`agentline: timed out waiting for file lock at ${lockPath}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

async function tryClearStaleLock(lockPath: string, treatAllAsStale: boolean): Promise<boolean> {
  let body = "";
  let mtimeMs = 0;
  try {
    body = (await fs.readFile(lockPath, "utf8")).trim();
    const stat = await fs.stat(lockPath);
    mtimeMs = stat.mtimeMs;
  } catch (err) {
    // Lock vanished between fail-to-open and read — try the open again.
    return isEnoent(err);
  }
  if (treatAllAsStale) {
    await fs.unlink(lockPath).catch(() => undefined);
    return true;
  }
  const pid = Number.parseInt(body, 10);
  const ownerDead = Number.isFinite(pid) && pid > 0 && !isPidAlive(pid);
  const tooOld = Date.now() - mtimeMs > STALE_LOCK_MS;
  if (ownerDead || tooOld) {
    await fs.unlink(lockPath).catch(() => undefined);
    return true;
  }
  return false;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isEexist(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "EEXIST";
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
