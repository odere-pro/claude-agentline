/**
 * Atomic-write helpers (§4.9).
 *
 * Two shapes serve the project's writes:
 *
 *   - `writeIdempotent` — the canonical "last write wins" path. Writes
 *     to a sibling tmp file, fsyncs the file handle, then renames over
 *     the target. Safe to call repeatedly; the rename is atomic on the
 *     same filesystem. Used by config persistence and every cache file
 *     under `${agentlineConfigDir}/state/`.
 *
 *   - `writeOnce` — exclusive create. Opens the target with `O_EXCL`
 *     ("create only — fail if it exists"), fsyncs, closes. Throws on
 *     EEXIST so a race between two writers resolves with exactly one
 *     winner. Used for the install-time settings backup, where the
 *     first writer's snapshot must NOT be clobbered.
 *
 * The render hot path never imports from here (§1.2 N6); only
 * `agentline install` / `doctor` / `config` / state-writers persist.
 */

import { promises as fs } from "node:fs";
import { dirname, basename, join } from "node:path";
import { randomBytes } from "node:crypto";

export interface AtomicWriteOptions {
  /** Final file mode (default `0o600` — config may contain auth hints). */
  readonly mode?: number;
  /** Parent dir mode if it has to be created (default `0o700`). */
  readonly dirMode?: number;
}

/**
 * Write `data` to `targetPath` via the tmp + fsync + rename pattern.
 * Overwrites any existing file at `targetPath`.
 */
export async function writeIdempotent(
  targetPath: string,
  data: Buffer | string,
  opts: AtomicWriteOptions = {},
): Promise<void> {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  const dir = dirname(targetPath);
  await fs.mkdir(dir, { recursive: true, mode: opts.dirMode ?? 0o700 });
  const tmp = join(dir, `.${basename(targetPath)}.${randomBytes(6).toString("hex")}.tmp`);
  const fh = await fs.open(tmp, "w", opts.mode ?? 0o600);
  try {
    await fh.writeFile(buf);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await fs.rename(tmp, targetPath);
  } catch (err) {
    await fs.unlink(tmp).catch(() => undefined);
    throw err;
  }
}

/** Convenience: JSON-stringify with two-space indent + trailing newline. */
export async function writeJsonIdempotent(
  targetPath: string,
  value: unknown,
  opts: AtomicWriteOptions = {},
): Promise<void> {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  await writeIdempotent(targetPath, json, opts);
}

/**
 * Create-only write. Opens `targetPath` with `O_EXCL` and throws if it
 * already exists (Node's `EEXIST`). Callers that want "first writer
 * wins" semantics catch the EEXIST and treat it as a no-op (see
 * `isEexist` in `lib/fs.ts`).
 *
 * Parent directories are created on demand; the file handle is fsynced
 * before close. No tmp/rename — the exclusive open is the atomicity
 * guarantee for the "create" case.
 */
export async function writeOnce(
  targetPath: string,
  data: Buffer | string,
  opts: AtomicWriteOptions = {},
): Promise<void> {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  await fs.mkdir(dirname(targetPath), { recursive: true, mode: opts.dirMode ?? 0o700 });
  const fh = await fs.open(targetPath, "wx", opts.mode ?? 0o600);
  try {
    await fh.writeFile(buf);
    await fh.sync();
  } finally {
    await fh.close();
  }
}
