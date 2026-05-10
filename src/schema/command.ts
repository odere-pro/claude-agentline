/**
 * Body for `agentline config schema [--write <dir>]` (§9.1, §4.7).
 *
 * Without `--write`, prints the JSON Schema to stdout.
 * With `--write <dir>`, atomically writes the schema to
 * `<dir>/agentline.config.schema.json` so editors can pick it up.
 */

import { join } from "node:path";
import { isHelpFlag, requestHelp } from "../cli/help.js";
import { atomicWrite } from "../config/atomic.js";
import { configSchemaJson } from "./embedded.js";

const HELP = `agentline config schema — print or write the config JSON Schema

Usage:
  agentline config schema [--write <dir>]

Options:
  --write <dir>  atomically write to <dir>/agentline.config.schema.json
  -h, --help     show this message

Without --write, the schema is printed to stdout.
`;

export interface SchemaCommandArgs {
  /** Directory to write the schema into; undefined → print to stdout. */
  writeDir?: string;
}

export async function runSchemaCommand(args: SchemaCommandArgs): Promise<number> {
  const json = configSchemaJson();
  if (!args.writeDir) {
    process.stdout.write(json);
    return 0;
  }
  const target = join(args.writeDir, "agentline.config.schema.json");
  await atomicWrite(target, json, { mode: 0o644 });
  process.stdout.write(`agentline: schema written to ${target}\n`);
  return 0;
}

export function parseSchemaArgs(rest: string[]): SchemaCommandArgs {
  const out: SchemaCommandArgs = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (isHelpFlag(arg)) {
      requestHelp(HELP);
    } else if (arg === "--write") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline config schema: --write requires a directory path");
      }
      out.writeDir = next;
      i++;
    } else if (arg.startsWith("--write=")) {
      out.writeDir = arg.slice("--write=".length);
    } else {
      throw new Error(`agentline config schema: unknown argument '${arg}'`);
    }
  }
  return out;
}
