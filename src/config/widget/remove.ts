/**
 * Body for `agentline config widget remove --line N --at I` (editor-redesign
 * plan, step 4).
 *
 * Drops the widget at the given position via `saveRemoveWidget`
 * (`loadConfig` → mutate → validate → atomic write). `--line` defaults to 0;
 * `--at` is required (use `agentline config widget list` to see indices).
 * The emptied line is kept in place. Stdout is a single confirmation line.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import { saveRemoveWidget } from "../mutate.js";
import { resolveConfigPaths } from "../paths.js";
import { resolveEnv } from "../../lib/env.js";
import { readIntFlag } from "./_args.js";

const PREFIX = "agentline config widget remove";

const HELP = `agentline config widget remove — drop a widget from the layout

Usage:
  agentline config widget remove [--line N] --at I

Options:
  --line N            line index the widget is on (default 0)
  --at I              index of the widget to remove (required)
  -h, --help          show this message

Run \`agentline config widget list\` first to see widget indices.
`;

export interface WidgetRemoveArgs {
  readonly line: number;
  readonly at: number;
}

export interface WidgetRemoveInput {
  readonly args: WidgetRemoveArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export async function runWidgetRemoveCommand(input: WidgetRemoveInput): Promise<number> {
  const env = resolveEnv(input);
  await saveRemoveWidget({ line: input.args.line, at: input.args.at }, { env });
  process.stdout.write(
    `agentline: removed the widget at line ${input.args.line}, index ${input.args.at} in ${resolveConfigPaths(env).userConfig}\n`,
  );
  return 0;
}

export function parseWidgetRemoveArgs(rest: readonly string[]): WidgetRemoveArgs {
  let line = 0;
  let at: number | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === undefined) continue;
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg === "--line" || arg.startsWith("--line=")) {
      line = readIntFlag(arg, rest, i, "--line", PREFIX);
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--at" || arg.startsWith("--at=")) {
      at = readIntFlag(arg, rest, i, "--at", PREFIX);
      if (!arg.includes("=")) i += 1;
    } else {
      throw new Error(`${PREFIX}: unexpected argument '${arg}'`);
    }
  }

  if (at === undefined) {
    throw new Error(`${PREFIX}: --at <index> is required`);
  }
  return { line, at };
}
