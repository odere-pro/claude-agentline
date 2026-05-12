/**
 * `agentline uninstall` — remove agentline from this host.
 *
 * Delegates to scripts/uninstall.sh. Flags are forwarded 1-to-1;
 * stdin/stdout/stderr are inherited.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isHelpFlag, requestHelp } from "../cli/help.js";

const HELP = `agentline uninstall — remove agentline from this host

Usage:
  agentline uninstall [--purge] [--dry-run]

Options:
  --purge     Also remove user-edited config files, themes, and skills.
  --dry-run   Print every action that would be taken; touch nothing.
  -h, --help  Show this message.

Steps performed:
  1. npm uninstall -g @agentline/cli.
  2. Remove shipped themes that are byte-identical to the bundled originals.
  3. Remove seeded user config if unchanged (or always with --purge).
  4. Remove agentline skill files from $HOME/.claude/agents/ if unchanged.
  5. Restore statusLine in Claude Code settings to its pre-install state.

Idempotent. Safe to re-run. User-edited skills are preserved unless --purge.
`;

export interface UninstallArgs {
  readonly purge: boolean;
  readonly dryRun: boolean;
}

export function parseUninstallArgs(rest: readonly string[]): UninstallArgs {
  let purge = false;
  let dryRun = false;
  for (const arg of rest) {
    if (arg === "--purge") purge = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline uninstall: unknown argument '${arg}'`);
  }
  return { purge, dryRun };
}

export async function runUninstallCommand(args: UninstallArgs): Promise<number> {
  const script = resolveScript("uninstall.sh");
  const argv: string[] = [];
  if (args.purge) argv.push("--purge");
  if (args.dryRun) argv.push("--dry-run");

  const result = spawnSync("bash", [script, ...argv], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function resolveScript(name: string): string {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const path = join(cliDir, "..", "scripts", name);
  if (!existsSync(path)) {
    throw new Error(
      `agentline uninstall: script not found at ${path}\n` +
        "  This command requires the agentline repository checkout.\n" +
        "  Clone https://github.com/odere-pro/claude-agentline and run from there.",
    );
  }
  return path;
}
