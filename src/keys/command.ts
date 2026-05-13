/**
 * Body for `agentline keys [--json]` (§9.1, §5.5).
 *
 * Reads the active keymap from the registry (default §5.5 table
 * with optional user `config.keymap` overrides) and prints either
 * a human-readable table or a JSON document. The JSON form is the
 * input for gate-17 (keymap coverage) — every default action MUST
 * appear in the listing so missing wiring is detectable mechanically.
 */

import { isHelpFlag, requestHelp } from "../cli/help.js";
import { loadConfig } from "../config/load.js";
import { listBindings, type KeyBinding } from "./bindings.js";

const HELP = `agentline keys — list active keymap bindings

Usage:
  agentline keys [--json]

Options:
  --json      emit machine-readable JSON
  -h, --help  show this message
`;

export interface KeysCommandArgs {
  readonly json: boolean;
}

export interface KeysInput {
  readonly args: KeysCommandArgs;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  readonly bindings?: readonly KeyBinding[];
}

export async function runKeysCommand(input: KeysInput): Promise<number> {
  const bindings = input.bindings ?? (await loadActiveBindings(input));
  const out = input.args.json ? formatJson(bindings) : formatText(bindings);
  process.stdout.write(out);
  return 0;
}

async function loadActiveBindings(input: KeysInput): Promise<readonly KeyBinding[]> {
  try {
    const loaded = await loadConfig({
      ...(input.env !== undefined ? { env: input.env } : {}),
      ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    });
    return listBindings(loaded.config.keymap);
  } catch {
    return listBindings();
  }
}

export function formatJson(bindings: readonly KeyBinding[]): string {
  const list = bindings.map((b) => ({
    key: b.key,
    action: b.action,
    scope: b.scope,
    description: b.description,
  }));
  return `${JSON.stringify({ bindings: list }, null, 2)}\n`;
}

export function formatText(bindings: readonly KeyBinding[]): string {
  const widest = bindings.reduce((n, b) => Math.max(n, b.key.length), 0);
  const lines: string[] = ["agentline keymap:", ""];
  for (const b of bindings) {
    const key = b.key.padEnd(widest, " ");
    const scope = `[${b.scope}]`;
    lines.push(`  ${key}  ${scope}  ${b.description}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function parseKeysArgs(rest: readonly string[]): KeysCommandArgs {
  let json = false;
  for (const arg of rest) {
    if (arg === "--json") json = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else if (arg) throw new Error(`agentline keys: unknown argument '${arg}'`);
  }
  return { json };
}
