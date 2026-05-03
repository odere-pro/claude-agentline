/**
 * Atomic JSON write helper (§4.9).
 *
 * Pattern: write-temp + fsync + rename.
 * The temp file is created in the same directory as the target so the
 * rename is guaranteed to be atomic on the same filesystem.
 *
 * The render path NEVER calls into here (§1.2 N6); only `agentline config`,
 * `agentline init`, and `scripts/install.sh` persist state.
 */

import { promises as fs } from "node:fs";
import { dirname, basename, join } from "node:path";
import { randomBytes } from "node:crypto";

export interface AtomicWriteOptions {
  /** Permission mode for the final file (default 0o600 — config may contain auth hints). */
  mode?: number;
  /** Permission mode for the parent directory if it has to be created (default 0o700). */
  dirMode?: number;
}

export async function atomicWriteJson(
  targetPath: string,
  value: unknown,
  opts: AtomicWriteOptions = {},
): Promise<void> {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  await atomicWrite(targetPath, Buffer.from(json, "utf8"), opts);
}

export async function atomicWrite(
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
