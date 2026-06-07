/**
 * Reversible config backup — a 2-slot stack backing `agentline config
 * undo` / `config redo`.
 *
 * The problem (brainstorm 04-self-healing §3, Bug 4): a `config.json.bak`
 * only existed after `doctor --fix` overwrote a corrupt config. TUI edits
 * and `config widget` mutations had no rollback. G5 added a single-slot
 * undo; F-B makes it reversible.
 *
 * Two slots, both siblings of the config:
 *   - `config.json.bak`  — the BACK slot (what `undo` restores).
 *   - `config.json.redo` — the FORWARD slot (what `redo` restores).
 *
 * Contract:
 *   - `backupAndWriteConfig` (a real edit — mutation or TUI save) backs up
 *     the current config to the back slot AND deletes the forward slot: a
 *     new edit diverges, so any pending redo is unreachable (standard
 *     undo/redo semantics).
 *   - `undoConfig` captures the pre-undo config into the forward slot, then
 *     restores the back slot — so a following `redo` can roll forward.
 *   - `redoConfig` captures the pre-redo config into the back slot, then
 *     restores the forward slot — so a following `undo` returns here. This
 *     makes undo↔redo a clean toggle (undo→redo→undo is byte-identical).
 *   - Every write goes through the one atomic-write helper (write-temp →
 *     fsync → rename); slot deletes tolerate an already-absent file.
 *   - The back slot is the same `config.json.bak` `doctor --fix` (fixD03)
 *     writes, so undo works after a repair too. Both slots are distinct
 *     from the host-statusLine `settings-backup.json` (untouched here).
 */

import { promises as fs } from "node:fs";

import {
  writeIdempotent,
  writeJsonIdempotent,
} from "../../../core/lib/atomic-write/atomic-write.js";
import { isEnoent } from "../../../core/lib/fs/fs.js";

/** The back-slot (undo) path for a given config path: `<config>.bak`. */
export function configBackupPath(configPath: string): string {
  return `${configPath}.bak`;
}

/** The forward-slot (redo) path for a given config path: `<config>.redo`. */
export function configRedoPath(configPath: string): string {
  return `${configPath}.redo`;
}

/** Read a file as UTF-8, or `null` when it is absent. */
async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

/** Delete a file, tolerating an already-absent target. */
async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }
}

/** Parse the slot at `path` as JSON, or `null` when absent; throws on torn JSON. */
async function readSlot(path: string): Promise<unknown | null> {
  const raw = await readFileOrNull(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`agentline: config backup at ${path} is not valid JSON: ${(err as Error).message}`);
  }
}

/**
 * Back up the current on-disk config (if any) to the back slot, INVALIDATE
 * the forward slot (a new edit diverges from any pending redo), then write
 * `next` to the config path. All writes are atomic. When no config exists
 * yet (first write), nothing is backed up.
 */
export async function backupAndWriteConfig(configPath: string, next: unknown): Promise<void> {
  const current = await readFileOrNull(configPath);
  if (current !== null) {
    await writeIdempotent(configBackupPath(configPath), current);
  }
  // A new edit makes the forward (redo) branch unreachable.
  await unlinkIfPresent(configRedoPath(configPath));
  await writeJsonIdempotent(configPath, next);
}

/**
 * Read the back (undo) slot as parsed JSON. Returns `null` when absent;
 * throws a helpful error on torn JSON.
 */
export async function readConfigBackup(configPath: string): Promise<unknown | null> {
  return readSlot(configBackupPath(configPath));
}

/**
 * Read the forward (redo) slot as parsed JSON. Returns `null` when absent;
 * throws a helpful error on torn JSON.
 */
export async function readConfigRedo(configPath: string): Promise<unknown | null> {
  return readSlot(configRedoPath(configPath));
}

/**
 * Restore the back slot over the current config (atomic write). Returns the
 * restored config, or `null` when there is no back slot. Leaves the slot in
 * place so a re-run restores the same bytes.
 *
 * Single-slot helper retained for callers that only need a non-reversible
 * restore. `undoConfig` is the reversible entry point.
 */
export async function restoreConfigBackup(configPath: string): Promise<unknown | null> {
  const backup = await readConfigBackup(configPath);
  if (backup === null) return null;
  await writeJsonIdempotent(configPath, backup);
  return backup;
}

/**
 * Roll back one step: capture the current (pre-undo) config into the
 * forward slot so `redoConfig` can roll forward, then restore the back
 * slot. Returns the restored config, or `null` when there is nothing to
 * undo (no back slot) — in which case nothing is written and no forward
 * slot is created.
 */
export async function undoConfig(configPath: string): Promise<unknown | null> {
  const backup = await readConfigBackup(configPath);
  if (backup === null) return null;
  const current = await readFileOrNull(configPath);
  if (current !== null) {
    await writeIdempotent(configRedoPath(configPath), current);
  }
  await writeJsonIdempotent(configPath, backup);
  return backup;
}

/**
 * Roll forward one step: capture the current (pre-redo) config into the
 * back slot so a following `undoConfig` returns here, then restore the
 * forward slot. Returns the restored config, or `null` when there is
 * nothing to redo (no forward slot) — in which case nothing is written.
 */
export async function redoConfig(configPath: string): Promise<unknown | null> {
  const forward = await readConfigRedo(configPath);
  if (forward === null) return null;
  const current = await readFileOrNull(configPath);
  if (current !== null) {
    await writeIdempotent(configBackupPath(configPath), current);
  }
  await writeJsonIdempotent(configPath, forward);
  return forward;
}
