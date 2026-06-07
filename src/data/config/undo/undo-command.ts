/**
 * `agentline config undo`
 *
 * Restores the most recent config backup (`config.json.bak`), rolling
 * back the last config-writing operation — a `config widget` mutation or
 * a TUI editor save (both write the backup before the new config lands).
 *
 * Single-level: it restores the one backup slot, not a multi-level
 * history. The backup is left in place after restoring, so re-running
 * `undo` restores the same bytes (it is not a redo). When no backup
 * exists yet, the command prints a clear message and exits non-zero — it
 * never crashes.
 *
 * Mirrors the other `config` verbs: a single confirmation line on stdout,
 * errors on stderr with the `agentline config undo` prefix, `--help`
 * prints help and does not act.
 */

import { isHelpFlag, requestHelp } from "../../../core/lib/help/help.js";
import { resolveEnv } from "../../../core/lib/env/env.js";
import { resolveConfigPaths } from "../paths/paths.js";
import { restoreConfigBackup } from "../backup/backup.js";

const PREFIX = "agentline config undo";

const HELP = `agentline config undo — roll back the last config change

Usage:
  agentline config undo

Restores the most recent config backup (config.json.bak), undoing the
last \`config widget\` mutation or TUI editor save. Single-level: it
restores one step back, not a multi-level history. Exits non-zero with a
message when there is nothing to undo.

Options:
  -h, --help   show this message
`;

/** `config undo` takes no arguments; the type documents the verb shape. */
export type UndoArgs = Record<string, never>;

export interface UndoInput {
  readonly args: UndoArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export function parseUndoArgs(rest: readonly string[]): UndoArgs {
  for (const arg of rest) {
    if (isHelpFlag(arg)) requestHelp(HELP);
    if (arg.startsWith("-")) throw new Error(`${PREFIX}: unknown option '${arg}'`);
    throw new Error(`${PREFIX}: unexpected argument '${arg}'`);
  }
  return {};
}

/** Count the widgets across every line, for a one-line restore summary. */
function widgetCount(config: unknown): number {
  if (typeof config !== "object" || config === null) return 0;
  const lines = (config as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return 0;
  let total = 0;
  for (const line of lines) {
    const widgets = (line as { widgets?: unknown }).widgets;
    if (Array.isArray(widgets)) total += widgets.length;
  }
  return total;
}

export async function runUndoCommand(input: UndoInput): Promise<number> {
  const env = resolveEnv(input);
  const userConfig = resolveConfigPaths(env).userConfig;

  let restored: unknown | null;
  try {
    restored = await restoreConfigBackup(userConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${PREFIX}: ${msg}\n`);
    return 1;
  }

  if (restored === null) {
    process.stderr.write(
      `${PREFIX}: nothing to undo — no config backup found (${userConfig}.bak)\n`,
    );
    return 1;
  }

  const count = widgetCount(restored);
  const noun = count === 1 ? "widget" : "widgets";
  process.stdout.write(
    `agentline: restored the previous config (${count} ${noun}) → ${userConfig}\n`,
  );
  return 0;
}

export async function runUndoSubgroup(rest: readonly string[]): Promise<number> {
  return runUndoCommand({ args: parseUndoArgs(rest) });
}
