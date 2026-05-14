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

const FORBIDDEN_OPTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

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
      line = readIntFlag(arg, rest, i, "--line");
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--at" || arg.startsWith("--at=")) {
      at = readIntFlag(arg, rest, i, "--at");
      if (!arg.includes("=")) i += 1;
    } else if (arg === "--options" || arg.startsWith("--options=")) {
      options = readOptionsFlag(arg, rest, i);
      if (!arg.includes("=")) i += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`agentline config widget replace: unknown option '${arg}'`);
    } else if (type === undefined) {
      type = arg;
    } else {
      throw new Error(`agentline config widget replace: unexpected argument '${arg}'`);
    }
  }

  if (type === undefined || type.trim() === "") {
    throw new Error("agentline config widget replace: a replacement <type> is required");
  }
  if (at === undefined) {
    throw new Error("agentline config widget replace: --at <index> is required");
  }
  const out: WidgetReplaceArgs = { type, line, at };
  if (options !== undefined) (out as { options: Record<string, unknown> }).options = options;
  return out;
}

function readIntFlag(arg: string, rest: readonly string[], i: number, name: string): number {
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[i + 1];
  if (raw === undefined || !/^-?\d+$/.test(raw)) {
    throw new Error(`agentline config widget replace: ${name} requires an integer`);
  }
  return Number(raw);
}

function readOptionsFlag(arg: string, rest: readonly string[], i: number): Record<string, unknown> {
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : rest[i + 1];
  if (raw === undefined) {
    throw new Error("agentline config widget replace: --options requires a JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `agentline config widget replace: --options is not valid JSON (${(err as Error).message})`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("agentline config widget replace: --options must be a JSON object");
  }
  for (const key of Object.keys(parsed as object)) {
    if (FORBIDDEN_OPTION_KEYS.has(key)) {
      throw new Error(`agentline config widget replace: option key '${key}' is not allowed`);
    }
  }
  return parsed as Record<string, unknown>;
}
