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
      line = readIntFlag(arg, rest, i, "--line");
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--at" || arg.startsWith("--at=")) {
      at = readIntFlag(arg, rest, i, "--at");
      if (!arg.includes("=")) i += 1;
    } else {
      throw new Error(`agentline config widget remove: unexpected argument '${arg}'`);
    }
  }

  if (at === undefined) {
    throw new Error("agentline config widget remove: --at <index> is required");
  }
  return { line, at };
}

function readIntFlag(arg: string, rest: readonly string[], i: number, name: string): number {
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[i + 1];
  if (raw === undefined || raw.startsWith("-")) {
    throw new Error(`agentline config widget remove: ${name} requires an integer`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new Error(`agentline config widget remove: ${name} must be an integer, got '${raw}'`);
  }
  return n;
}
