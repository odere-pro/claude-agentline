/**
 * Single-slot config backup — the rollback substrate for
 * `agentline config undo`.
 *
 * The problem (brainstorm 04-self-healing §3, Bug 4): a `config.json.bak`
 * only existed after `doctor --fix` overwrote a corrupt config. TUI edits
 * and `config widget` mutations had NO rollback. This module gives every
 * config-writing path a single-slot backup of the prior config, written
 * BEFORE the new config lands, so `config undo` can restore it.
 *
 * Contract:
 *   - The backup lives at `<config.json>.bak` — the same path
 *     `doctor --fix` (fixD03) already writes, so `undo` works after a
 *     repair too. This is NOT the host-statusLine `settings-backup.json`
 *     (a different surface, untouched here).
 *   - One slot, last-write-wins: each write refreshes the backup to the
 *     immediately-prior config. Undo is single-level — it restores the
 *     most recent backup, not a multi-level history.
 *   - Every write goes through the one atomic-write helper (write-temp →
 *     fsync → rename) — no second write mechanism.
 *   - `restoreConfigBackup` leaves the backup in place, so a re-run
 *     restores the same bytes (idempotent), rather than acting as a redo.
 */

import { promises as fs } from "node:fs";

import { writeIdempotent, writeJsonIdempotent } from "../../../core/lib/atomic-write/atomic-write.js";
import { isEnoent } from "../../../core/lib/fs/fs.js";

/** The backup path for a given config path: `<config>.bak`. */
export function configBackupPath(configPath: string): string {
  return `${configPath}.bak`;
}

/**
 * Back up the current on-disk config (if any) to `<config>.bak`, then
 * write `next` to the config path. Both writes are atomic. When no config
 * exists yet (first write), nothing is backed up — there is no prior
 * state to roll back to.
 */
export async function backupAndWriteConfig(
  configPath: string,
  next: unknown,
): Promise<void> {
  let current: string | null;
  try {
    current = await fs.readFile(configPath, "utf8");
  } catch (err) {
    if (isEnoent(err)) current = null;
    else throw err;
  }
  if (current !== null) {
    await writeIdempotent(configBackupPath(configPath), current);
  }
  await writeJsonIdempotent(configPath, next);
}

/**
 * Read the config backup as parsed JSON. Returns `null` when no backup
 * exists; throws a helpful error on malformed JSON so a torn backup is
 * surfaced rather than silently dropped.
 */
export async function readConfigBackup(configPath: string): Promise<unknown | null> {
  const backupPath = configBackupPath(configPath);
  let raw: string;
  try {
    raw = await fs.readFile(backupPath, "utf8");
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `agentline: config backup at ${backupPath} is not valid JSON: ${(err as Error).message}`,
    );
  }
}

/**
 * Restore the config backup over the current config (atomic write).
 * Returns the restored config, or `null` when there is no backup to
 * restore (the caller decides how to message "nothing to undo"). The
 * backup file is left in place so a re-run restores the same bytes.
 */
export async function restoreConfigBackup(configPath: string): Promise<unknown | null> {
  const backup = await readConfigBackup(configPath);
  if (backup === null) return null;
  await writeJsonIdempotent(configPath, backup);
  return backup;
}
