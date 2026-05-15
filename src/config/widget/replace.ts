/**
 * Body for `agentline config widget replace <type> --at I [--line N] [--options JSON]`
 * (editor-redesign plan, step 4).
 *
 * Swaps the widget at the given position for a fresh one of `<type>` via
 * `saveReplaceWidget`. `--line` defaults to 0; `--at` is required;
 * `--options` sets the replacement's `options` block (prototype-polluting
 * keys rejected). Stdout is a single confirmation line.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import { saveReplaceWidget } from "../mutate.js";
import { resolveConfigPaths } from "../paths.js";
import { resolveEnv } from "../../lib/env.js";
import type { WidgetConfig } from "../types.js";
import { readIntFlag, readOptionsFlag } from "./_args.js";

const PREFIX = "agentline config widget replace";

const HELP = `agentline config widget replace — swap the widget at a position

Usage:
  agentline config widget replace <type> [--line N] --at I [--options JSON]

Arguments:
  <type>              replacement widget type — see \`agentline config widget catalog\`

Options:
  --line N            line the widget is on (default 0)
  --at I              index of the widget to replace (required)
  --options JSON      JSON object for the replacement's \`options\` block
  -h, --help          show this message

Run \`agentline config widget list\` first to see widget indices.
`;

export interface WidgetReplaceArgs {
  readonly type: string;
  readonly line: number;
  readonly at: number;
  readonly options?: Record<string, unknown>;
}

export interface WidgetReplaceInput {
  readonly args: WidgetReplaceArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export async function runWidgetReplaceCommand(input: WidgetReplaceInput): Promise<number> {
  const env = resolveEnv(input);
  const widget: WidgetConfig =
    input.args.options !== undefined
      ? { type: input.args.type, options: input.args.options }
      : { type: input.args.type };
  await saveReplaceWidget({ line: input.args.line, at: input.args.at, widget }, { env });
  process.stdout.write(
    `agentline: replaced the widget at line ${input.args.line}, index ${input.args.at} with '${input.args.type}' in ${resolveConfigPaths(env).userConfig}\n`,
  );
  return 0;
}

export function parseWidgetReplaceArgs(rest: readonly string[]): WidgetReplaceArgs {
  let type: string | undefined;
  let line = 0;
  let at: number | undefined;
  let options: Record<string, unknown> | undefined;

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
    } else if (arg === "--options" || arg.startsWith("--options=")) {
      options = readOptionsFlag(arg, rest, i, PREFIX);
      if (!arg.includes("=")) i += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`${PREFIX}: unknown option '${arg}'`);
    } else if (type === undefined) {
      type = arg;
    } else {
      throw new Error(`${PREFIX}: unexpected argument '${arg}'`);
    }
  }

  if (type === undefined || type.trim() === "") {
    throw new Error(`${PREFIX}: a replacement <type> is required`);
  }
  if (at === undefined) {
    throw new Error(`${PREFIX}: --at <index> is required`);
  }
  const out: WidgetReplaceArgs = { type, line, at };
  if (options !== undefined) (out as { options: Record<string, unknown> }).options = options;
  return out;
}
