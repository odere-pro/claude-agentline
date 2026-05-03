/**
 * Body for `agentline schema [--write <dir>]` (§9.1, §4.7).
 *
 * Without `--write`, prints the JSON Schema to stdout.
 * With `--write <dir>`, atomically writes the schema to
 * `<dir>/agentline.config.schema.json` so editors can pick it up.
 */

import { join } from "node:path";
import { atomicWrite } from "../config/atomic.js";
import { configSchemaJson } from "./embedded.js";

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
    if (arg === "--write") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("agentline schema: --write requires a directory path");
      }
      out.writeDir = next;
      i++;
    } else if (arg.startsWith("--write=")) {
      out.writeDir = arg.slice("--write=".length);
    } else {
      throw new Error(`agentline schema: unknown argument '${arg}'`);
    }
  }
  return out;
}
