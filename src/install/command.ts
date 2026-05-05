/**
 * `agentline install` — wire @agentline/cli into Claude Code's statusline.
 *
 * Delegates to scripts/install.sh. Flags are forwarded 1-to-1; stdin/
 * stdout/stderr are inherited so the interactive global-wire prompt
 * passes through to the terminal unchanged.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isHelpFlag, requestHelp } from "../cli/help.js";

const HELP = `agentline install — wire @agentline/cli into Claude Code's statusline

Usage:
  agentline install [--from-source] [--global | --local-only] [--force] [--dry-run]

Options:
  --from-source   npm link from the local checkout instead of installing from
                  the registry. Use when developing agentline itself.
  --global        Also wire statusLine into $HOME/.claude/settings.json
                  without prompting.
  --local-only    Wire the local project only; skip the global prompt.
  --force         Overwrite an existing statusLine value even when it does
                  not point at agentline.
  --dry-run       Print every action that would be taken; touch nothing.
  -h, --help      Show this message.

Steps performed:
  1. Install @agentline/cli globally (or npm link with --from-source).
  2. Seed user config from the default template (preserves existing).
  3. Seed shipped themes into the user themes directory.
  4. Install agentline skill files into $HOME/.claude/agents/.
  5. Wire statusLine into .claude/settings.json (local, and optionally global).

By default statusLine is wired into the current project's
.claude/settings.json. You will be asked whether to also wire it globally
into $HOME/.claude/settings.json.
`;

export interface InstallArgs {
  readonly fromSource: boolean;
  readonly global: -1 | 0 | 1; // -1 = ask, 0 = local-only, 1 = also global
  readonly force: boolean;
  readonly dryRun: boolean;
}

export function parseInstallArgs(rest: readonly string[]): InstallArgs {
  let fromSource = false;
  let global_: -1 | 0 | 1 = -1;
  let force = false;
  let dryRun = false;
  for (const arg of rest) {
    if (arg === "--from-source") fromSource = true;
    else if (arg === "--global") global_ = 1;
    else if (arg === "--local-only") global_ = 0;
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline install: unknown argument '${arg}'`);
  }
  return { fromSource, global: global_, force, dryRun };
}

export async function runInstallCommand(args: InstallArgs): Promise<number> {
  const script = resolveScript("install.sh");
  const argv: string[] = [];
  if (args.fromSource) argv.push("--from-source");
  if (args.global === 1) argv.push("--global");
  if (args.global === 0) argv.push("--local-only");
  if (args.force) argv.push("--force");
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
      `agentline install: script not found at ${path}\n` +
        "  This command requires the agentline repository checkout.\n" +
        "  Clone https://github.com/odere-pro/claude-agentline and run from there.",
    );
  }
  return path;
}
