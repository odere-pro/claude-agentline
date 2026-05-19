/**
 * Body for `agentline config widget add <type> [--line N] [--at I] [--options JSON]`
 * (editor-redesign plan, step 4).
 *
 * Inserts a built-in widget into the user config via `saveAddWidget`
 * (`loadConfig` → mutate → validate → atomic write). `--line` defaults to
 * 0; `--at` defaults to the end of the line; `--options` takes a JSON
 * object for the widget's `options` block. Stdout stays a single
 * confirmation line so a skill can chain commands; errors go to stderr and
 * exit 2.
 */

import { isHelpFlag, requestHelp } from "../../../commands/cli/help.js";
import { saveAddWidget } from "../mutate.js";
import { resolveConfigPaths } from "../paths.js";
import { resolveEnv } from "../../../core/lib/env.js";
import type { WidgetConfig } from "../types.js";
import { readIntFlag, readOptionsFlag } from "./_args.js";

const PREFIX = "agentline config widget add";

const HELP = `agentline config widget add — insert a widget into the layout

Usage:
  agentline config widget add <type> [--line N] [--at I] [--options JSON]

Arguments:
  <type>              widget type — see \`agentline config widget catalog\`

Options:
  --line N            target line index (0..2, default 0; pads empty lines)
  --at I              insert position within the line (default: append)
  --options JSON      JSON object for the widget's \`options\` block
  -h, --help          show this message

Verify with \`agentline config widget list\`.
`;

export interface WidgetAddArgs {
  readonly type: string;
  readonly line: number;
  readonly at?: number;
  readonly options?: Record<string, unknown>;
}

export interface WidgetAddInput {
  readonly args: WidgetAddArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export async function runWidgetAddCommand(input: WidgetAddInput): Promise<number> {
  const env = resolveEnv(input);
  const widget: WidgetConfig =
    input.args.options !== undefined
      ? { type: input.args.type, options: input.args.options }
      : { type: input.args.type };
  await saveAddWidget({ line: input.args.line, at: input.args.at, widget }, { env });
  const where =
    input.args.at !== undefined
      ? `line ${input.args.line}, index ${input.args.at}`
      : `line ${input.args.line}`;
  process.stdout.write(
    `agentline: added '${input.args.type}' (${where}) in ${resolveConfigPaths(env).userConfig}\n`,
  );
  return 0;
}

export function parseWidgetAddArgs(rest: readonly string[]): WidgetAddArgs {
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
    throw new Error(`${PREFIX}: a widget <type> is required`);
  }
  const out: WidgetAddArgs = { type, line };
  if (at !== undefined) (out as { at: number }).at = at;
  if (options !== undefined) (out as { options: Record<string, unknown> }).options = options;
  return out;
}
