/**
 * Body for `agentline config widget move --from-at I [--from-line N] [--to-line M] [--to-at J]`
 * (editor-redesign plan, step 4).
 *
 * Moves a widget within or between lines via `saveMoveWidget`. `--from-line`
 * defaults to 0; `--from-at` is required; `--to-line` defaults to
 * `--from-line`; `--to-at` defaults to the end of the destination line and
 * is interpreted *after* the source widget is removed. Stdout is a single
 * confirmation line.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import { saveMoveWidget } from "../mutate.js";
import { resolveConfigPaths } from "../paths.js";
import { resolveEnv } from "../../lib/env.js";
import { readIntFlag } from "./_args.js";

const PREFIX = "agentline config widget move";

const HELP = `agentline config widget move — reorder a widget within or across lines

Usage:
  agentline config widget move [--from-line N] --from-at I [--to-line M] [--to-at J]

Options:
  --from-line N       line the widget is currently on (default 0)
  --from-at I         current index of the widget (required)
  --to-line M         destination line (default: --from-line)
  --to-at J           destination index, after the source is removed
                      (default: append to the destination line)
  -h, --help          show this message

Run \`agentline config widget list\` first to see widget indices.
`;

export interface WidgetMoveArgs {
  readonly fromLine: number;
  readonly fromAt: number;
  readonly toLine: number;
  readonly toAt?: number;
}

export interface WidgetMoveInput {
  readonly args: WidgetMoveArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export async function runWidgetMoveCommand(input: WidgetMoveInput): Promise<number> {
  const env = resolveEnv(input);
  await saveMoveWidget(
    {
      fromLine: input.args.fromLine,
      fromAt: input.args.fromAt,
      toLine: input.args.toLine,
      toAt: input.args.toAt,
    },
    { env },
  );
  const dest =
    input.args.toAt !== undefined
      ? `line ${input.args.toLine}, index ${input.args.toAt}`
      : `the end of line ${input.args.toLine}`;
  process.stdout.write(
    `agentline: moved the widget from line ${input.args.fromLine}, index ${input.args.fromAt} to ${dest} in ${resolveConfigPaths(env).userConfig}\n`,
  );
  return 0;
}

export function parseWidgetMoveArgs(rest: readonly string[]): WidgetMoveArgs {
  let fromLine = 0;
  let fromAt: number | undefined;
  let toLine: number | undefined;
  let toAt: number | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === undefined) continue;
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg === "--from-line" || arg.startsWith("--from-line=")) {
      fromLine = readIntFlag(arg, rest, i, "--from-line", PREFIX);
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--from-at" || arg.startsWith("--from-at=")) {
      fromAt = readIntFlag(arg, rest, i, "--from-at", PREFIX);
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--to-line" || arg.startsWith("--to-line=")) {
      toLine = readIntFlag(arg, rest, i, "--to-line", PREFIX);
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--to-at" || arg.startsWith("--to-at=")) {
      toAt = readIntFlag(arg, rest, i, "--to-at", PREFIX);
      if (!arg.includes("=")) i += 1;
    } else {
      throw new Error(`${PREFIX}: unexpected argument '${arg}'`);
    }
  }

  if (fromAt === undefined) {
    throw new Error(`${PREFIX}: --from-at <index> is required`);
  }
  const out: WidgetMoveArgs = { fromLine, fromAt, toLine: toLine ?? fromLine };
  if (toAt !== undefined) (out as { toAt: number }).toAt = toAt;
  return out;
}
