/**
 * `agentline config redo`
 *
 * Rolls forward to the config that `agentline config undo` last rolled
 * back from (the forward slot, `config.json.redo`). Symmetric with undo:
 * it captures the pre-redo config into the back slot so a following `undo`
 * returns here, making undo↔redo a clean toggle.
 *
 * A new edit after an undo (a `config widget` mutation or a TUI save)
 * invalidates the forward slot — you cannot redo into a branch you have
 * diverged from. When there is nothing to redo, it prints a clear message
 * and exits non-zero — it never crashes.
 *
 * Mirrors the other `config` verbs: a single confirmation line on stdout,
 * errors on stderr with the `agentline config redo` prefix, `--help`
 * prints help and does not act.
 */

import { isHelpFlag, requestHelp } from "../../../core/lib/help/help.js";
import { resolveEnv } from "../../../core/lib/env/env.js";
import { resolveConfigPaths } from "../paths/paths.js";
import { redoConfig } from "../backup/backup.js";

const PREFIX = "agentline config redo";

const HELP = `agentline config redo — re-apply a change rolled back by undo

Usage:
  agentline config redo

Rolls forward to the config that \`agentline config undo\` last rolled
back from. A new \`config widget\` mutation or TUI editor save after an
undo invalidates the redo. Exits non-zero with a message when there is
nothing to redo.

Options:
  -h, --help   show this message
`;

/** `config redo` takes no arguments; the type documents the verb shape. */
export type RedoArgs = Record<string, never>;

export interface RedoInput {
  readonly args: RedoArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export function parseRedoArgs(rest: readonly string[]): RedoArgs {
  for (const arg of rest) {
    if (isHelpFlag(arg)) requestHelp(HELP);
    if (arg.startsWith("-")) throw new Error(`${PREFIX}: unknown option '${arg}'`);
    throw new Error(`${PREFIX}: unexpected argument '${arg}'`);
  }
  return {};
}

/** Count the widgets across every line, for a one-line confirmation summary. */
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

export async function runRedoCommand(input: RedoInput): Promise<number> {
  const env = resolveEnv(input);
  const userConfig = resolveConfigPaths(env).userConfig;

  let restored: unknown | null;
  try {
    restored = await redoConfig(userConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${PREFIX}: ${msg}\n`);
    return 1;
  }

  if (restored === null) {
    process.stderr.write(
      `${PREFIX}: nothing to redo — no forward config found (${userConfig}.redo)\n`,
    );
    return 1;
  }

  const count = widgetCount(restored);
  const noun = count === 1 ? "widget" : "widgets";
  process.stdout.write(
    `agentline: reapplied the config (${count} ${noun}) → ${userConfig} (undo with \`agentline config undo\`)\n`,
  );
  return 0;
}

export async function runRedoSubgroup(rest: readonly string[]): Promise<number> {
  return runRedoCommand({ args: parseRedoArgs(rest) });
}
