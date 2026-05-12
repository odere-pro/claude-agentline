/**
 * Pre-install snapshot of the host settings file's `statusLine` value.
 * Lets `agentline doctor --fix` and `scripts/install.sh` overwrite the
 * key while preserving exactly what was there before, so
 * `scripts/uninstall.sh` can put the host back to its pre-install state.
 *
 * Backup contract:
 *
 *   - Lives under `state/settings-backup.json` inside the agentline
 *     config directory (resolved via `resolveBackupPaths`).
 *   - Records whether `statusLine` was present at all (so uninstall knows
 *     to delete the key vs. write a value back).
 *   - Records the full prior value (the host accepts string OR object
 *     statusLine forms; we preserve whichever was there).
 *   - Written atomically.
 *   - Idempotent: `saveStatusLineBackup` refuses to overwrite an existing
 *     backup. The first install wins — re-running install must NOT clobber
 *     the original pre-install state with our own freshly-written value.
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { atomicWriteJson } from "../config/atomic.js";
import { isEnoent, pathExists } from "../lib/fs.js";
import { AGENTLINE_VERSION } from "../version.js";

export const STATUS_LINE_BACKUP_VERSION = 1 as const;

export interface StatusLineBackup {
  readonly version: typeof STATUS_LINE_BACKUP_VERSION;
  readonly createdAt: string;
  readonly agentlineVersion: string;
  readonly previousStatusLinePresent: boolean;
  /**
   * The exact prior value of `settings.statusLine`. `null` is meaningful
   * (the user set it to JSON null) and is distinct from
   * `previousStatusLinePresent: false` which means the key was absent.
   */
  readonly previousStatusLine: unknown;
}

export interface BackupPaths {
  readonly backupFile: string;
  readonly stateDir: string;
}

export function resolveBackupPaths(
  env: NodeJS.ProcessEnv = process.env,
): BackupPaths {
  // Match `scripts/lib/common.sh`: CLAUDE_CONFIG_DIR is the agentline
  // directory when set (not the parent); when unset, default to
  // ~/.config/agentline. This keeps the backup location identical
  // whether the user installs via `agentline doctor --fix` (TS) or
  // `scripts/install.sh` (shell), so each tool can read what the other
  // wrote.
  const cfg = env.CLAUDE_CONFIG_DIR;
  const agentlineDir =
    cfg && cfg.length > 0 ? cfg : join(homedir(), ".config", "agentline");
  const stateDir = join(agentlineDir, "state");
  return { stateDir, backupFile: join(stateDir, "settings-backup.json") };
}

/**
 * Save the current `statusLine` value to the backup file.
 *
 * @returns `"created"` when a fresh backup was written,
 *          `"skipped"` when a backup already existed (first install wins).
 */
export async function saveStatusLineBackup(args: {
  readonly previousStatusLine: unknown;
  readonly previousStatusLinePresent: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly backupFile?: string;
  readonly clock?: () => Date;
}): Promise<"created" | "skipped"> {
  const target = args.backupFile ?? resolveBackupPaths(args.env).backupFile;
  if (await pathExists(target)) return "skipped";
  const body: StatusLineBackup = {
    version: STATUS_LINE_BACKUP_VERSION,
    createdAt: (args.clock ?? (() => new Date()))().toISOString(),
    agentlineVersion: AGENTLINE_VERSION,
    previousStatusLinePresent: args.previousStatusLinePresent,
    previousStatusLine: args.previousStatusLine,
  };
  await atomicWriteJson(target, body, { mode: 0o600, dirMode: 0o700 });
  return "created";
}

/**
 * Read the backup file. Returns `null` when no backup exists; throws on
 * malformed JSON or schema mismatch (the caller decides whether to fall
 * back to the legacy "remove if-points-at-agentline" behaviour).
 */
export async function readStatusLineBackup(args: {
  readonly env?: NodeJS.ProcessEnv;
  readonly backupFile?: string;
} = {}): Promise<StatusLineBackup | null> {
  const target = args.backupFile ?? resolveBackupPaths(args.env).backupFile;
  let raw: string;
  try {
    raw = await fs.readFile(target, "utf8");
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`agentline: backup at ${target} is not valid JSON: ${(err as Error).message}`);
  }
  return validateBackup(parsed, target);
}

/**
 * Delete the backup file. No-op when the file is already absent.
 */
export async function deleteStatusLineBackup(args: {
  readonly env?: NodeJS.ProcessEnv;
  readonly backupFile?: string;
} = {}): Promise<void> {
  const target = args.backupFile ?? resolveBackupPaths(args.env).backupFile;
  try {
    await fs.unlink(target);
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }
}

function validateBackup(parsed: unknown, source: string): StatusLineBackup {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`agentline: backup at ${source} is not a JSON object`);
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== STATUS_LINE_BACKUP_VERSION) {
    throw new Error(
      `agentline: backup at ${source} has unsupported version ${String(o.version)}; expected ${STATUS_LINE_BACKUP_VERSION}`,
    );
  }
  if (typeof o.previousStatusLinePresent !== "boolean") {
    throw new Error(`agentline: backup at ${source} missing previousStatusLinePresent`);
  }
  return {
    version: STATUS_LINE_BACKUP_VERSION,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    agentlineVersion: typeof o.agentlineVersion === "string" ? o.agentlineVersion : "",
    previousStatusLinePresent: o.previousStatusLinePresent,
    previousStatusLine: o.previousStatusLine,
  };
}


/**
 * Path of the agentline state directory (parent of the backup file).
 * Callers can use this for cleanup sweeps; we don't recursively rm here.
 */
export function backupStateDir(env: NodeJS.ProcessEnv = process.env): string {
  return resolveBackupPaths(env).stateDir;
}
