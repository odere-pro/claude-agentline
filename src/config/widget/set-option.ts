/**
 * Body for `agentline config widget set-option <key> <value> --at I [--line N] [--json]`
 * (editor-redesign plan, step 4).
 *
 * Sets one option on the widget at the given position via
 * `saveSetWidgetOption`. `--line` defaults to 0; `--at` is required.
 * `<value>` is stored as a string unless `--json` is passed, in which case
 * it is parsed as a JSON literal (number / boolean / null / array / object).
 * `setWidgetOption` rejects `__proto__` / `constructor` / `prototype` keys.
 */

import { isHelpFlag, requestHelp } from "../../cli/help.js";
import { saveSetWidgetOption } from "../mutate.js";
import { resolveConfigPaths } from "../paths.js";
import { resolveEnv } from "../../lib/env.js";

const HELP = `agentline config widget set-option — set one option on a widget

Usage:
  agentline config widget set-option <key> <value> [--line N] --at I [--json]

Arguments:
  <key>               option name
  <value>             option value — a string, unless --json is given

Options:
  --line N            line the widget is on (default 0)
  --at I              index of the widget (required)
  --json              parse <value> as a JSON literal instead of a string
  -h, --help          show this message
`;

export interface WidgetSetOptionArgs {
  readonly line: number;
  readonly at: number;
  readonly key: string;
  readonly value: unknown;
}

export interface WidgetSetOptionInput {
  readonly args: WidgetSetOptionArgs;
  readonly env?: NodeJS.ProcessEnv;
}

export async function runWidgetSetOptionCommand(input: WidgetSetOptionInput): Promise<number> {
  const env = resolveEnv(input);
  await saveSetWidgetOption(
    { line: input.args.line, at: input.args.at, key: input.args.key, value: input.args.value },
    { env },
  );
  process.stdout.write(
    `agentline: set option '${input.args.key}' on the widget at line ${input.args.line}, index ${input.args.at} in ${resolveConfigPaths(env).userConfig}\n`,
  );
  return 0;
}

export function parseWidgetSetOptionArgs(rest: readonly string[]): WidgetSetOptionArgs {
  let line = 0;
  let at: number | undefined;
  let json = false;
  const positionals: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === undefined) continue;
    if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg === "--json") json = true;
    else if (arg === "--line" || arg.startsWith("--line=")) {
      line = readIntFlag(arg, rest, i, "--line");
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--at" || arg.startsWith("--at=")) {
      at = readIntFlag(arg, rest, i, "--at");
      if (!arg.includes("=")) i += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`agentline config widget set-option: unknown option '${arg}'`);
    } else {
      positionals.push(arg);
    }
  }

  const [key, rawValue] = positionals;
  if (key === undefined || rawValue === undefined || positionals.length > 2) {
    throw new Error("agentline config widget set-option: a <key> and a <value> are required");
  }
  if (at === undefined) {
    throw new Error("agentline config widget set-option: --at <index> is required");
  }
  const value = json ? parseJsonValue(rawValue) : rawValue;
  return { line, at, key, value };
}

function readIntFlag(arg: string, rest: readonly string[], i: number, name: string): number {
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[i + 1];
  if (raw === undefined || !/^-?\d+$/.test(raw)) {
    throw new Error(`agentline config widget set-option: ${name} requires an integer`);
  }
  return Number(raw);
}

function parseJsonValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `agentline config widget set-option: --json was given but <value> is not valid JSON (${(err as Error).message})`,
    );
  }
}
