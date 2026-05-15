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
import { dirname } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";

import { isEexist, isEnoent } from "../lib/fs.js";
import { isPlainObject } from "../lib/object.js";
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
 * Concurrency contract: only the first writer wins. Two concurrent
 * `agentline doctor --fix` runs (or `install` + `doctor`) race the
 * exclusive `O_EXCL` open on the target path — exactly one succeeds and
 * writes the body; the others observe `EEXIST` and return `"skipped"`
 * without touching the file. The earlier check-then-write pattern had a
 * TOCTOU window between `pathExists` and the temp-rename in
 * `atomicWriteJson` that allowed the loser to clobber the winner's
 * snapshot of the original `statusLine`, defeating "first install wins".
 *
 * Trade-off: skipping the temp+rename pattern means a process killed
 * mid-write leaves a partial JSON file at the target. The backup is
 * written once per install and is small (≤ ~256 bytes), so the
 * partial-write window is microseconds and recovery is `rm <file>`.
 *
 * @returns `"created"` when this caller wrote the backup,
 *          `"skipped"` when another caller had already won the race.
 */
export async function saveStatusLineBackup(args: {
  readonly previousStatusLine: unknown;
  readonly previousStatusLinePresent: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly backupFile?: string;
  readonly clock?: () => Date;
}): Promise<"created" | "skipped"> {
  const target = args.backupFile ?? resolveBackupPaths(args.env).backupFile;
  await fs.mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const body: StatusLineBackup = {
    version: STATUS_LINE_BACKUP_VERSION,
    createdAt: (args.clock ?? (() => new Date()))().toISOString(),
    agentlineVersion: AGENTLINE_VERSION,
    previousStatusLinePresent: args.previousStatusLinePresent,
    previousStatusLine: args.previousStatusLine,
  };
  let fh: Awaited<ReturnType<typeof fs.open>>;
  try {
    fh = await fs.open(target, "wx", 0o600);
  } catch (err) {
    if (isEexist(err)) return "skipped";
    throw err;
  }
  try {
    await fh.writeFile(`${JSON.stringify(body, null, 2)}\n`, "utf8");
    await fh.sync();
  } finally {
    await fh.close();
  }
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
  if (!isPlainObject(parsed)) {
    throw new Error(`agentline: backup at ${source} is not a JSON object`);
  }
  if (parsed.version !== STATUS_LINE_BACKUP_VERSION) {
    throw new Error(
      `agentline: backup at ${source} has unsupported version ${String(parsed.version)}; expected ${STATUS_LINE_BACKUP_VERSION}`,
    );
  }
  if (typeof parsed.previousStatusLinePresent !== "boolean") {
    throw new Error(`agentline: backup at ${source} missing previousStatusLinePresent`);
  }
  return {
    version: STATUS_LINE_BACKUP_VERSION,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    agentlineVersion: typeof parsed.agentlineVersion === "string" ? parsed.agentlineVersion : "",
    previousStatusLinePresent: parsed.previousStatusLinePresent,
    previousStatusLine: parsed.previousStatusLine,
  };
}


/**
 * Path of the agentline state directory (parent of the backup file).
 * Callers can use this for cleanup sweeps; we don't recursively rm here.
 */
export function backupStateDir(env: NodeJS.ProcessEnv = process.env): string {
  return resolveBackupPaths(env).stateDir;
}
