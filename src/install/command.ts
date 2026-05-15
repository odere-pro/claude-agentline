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
import { projectGate } from "../lib/claude-project.js";
import { maybeRefresh } from "../update-check/index.js";

const HELP = `agentline install — wire @agentline/cli into Claude Code's statusline

Usage:
  agentline install [--from-source] [--force] [--dry-run]

Options:
  --from-source   npm link from the local checkout instead of installing from
                  the registry. Use when developing agentline itself.
  --force         Overwrite an existing statusLine value even when it does
                  not point at agentline.
  --dry-run       Print every action that would be taken; touch nothing.
  -h, --help      Show this message.

Steps performed:
  1. Install @agentline/cli globally (or npm link with --from-source).
  2. Seed user config from the default template (preserves existing).
  3. Seed shipped themes into the user themes directory.
  4. Install agentline skill files into $HOME/.claude/agents/.
  5. Wire statusLine into $HOME/.claude/settings.json.
  6. Write install manifest to track managed files.
`;

export interface InstallArgs {
  readonly fromSource: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
}

export function parseInstallArgs(rest: readonly string[]): InstallArgs {
  let fromSource = false;
  let force = false;
  let dryRun = false;
  for (const arg of rest) {
    if (arg === "--from-source") fromSource = true;
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (isHelpFlag(arg)) requestHelp(HELP);
    else throw new Error(`agentline install: unknown argument '${arg}'`);
  }
  return { fromSource, force, dryRun };
}

export interface InstallRunOptions {
  /** Cwd the project-gate probes. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Stdin override for the project-gate prompt; tests inject a PassThrough. */
  readonly stdin?: NodeJS.ReadableStream & { readonly isTTY?: boolean };
}

export async function runInstallCommand(
  args: InstallArgs,
  opts: InstallRunOptions = {},
): Promise<number> {
  const gate = await projectGate({
    command: "install",
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    ...(opts.stdin !== undefined ? { stdin: opts.stdin } : {}),
  });
  if (gate === "skip") return 0;
  const script = resolveScript("install.sh");
  const argv: string[] = [];
  if (args.fromSource) argv.push("--from-source");
  if (args.force) argv.push("--force");
  if (args.dryRun) argv.push("--dry-run");

  const result = spawnSync("bash", [script, ...argv], { stdio: "inherit" });
  if (result.error) throw result.error;
  /*
   * Fire-and-forget npm-registry probe so a subsequent `agentline
   * doctor` has a populated cache. Dry-run skips it — the user hasn't
   * committed to anything, and dry-run is expected to do zero outbound
   * I/O. Failure is swallowed inside `maybeRefresh`.
   */
  if (!args.dryRun && result.status === 0) {
    void maybeRefresh();
  }
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
